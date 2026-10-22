# Deploying Halo CRM: Docker and Kubernetes

This guide takes the app from source code to a running Kubernetes deployment on your laptop,
one step at a time. Each step says what happens and why, so it doubles as a hands-on intro to
containers and Kubernetes.

| Path | What you get | Time |
|---|---|---|
| [A. Docker images](#a-docker-images) | Two images: `halo-api`, `halo-web` | 3 min |
| [B. Docker Compose](#b-docker-compose-one-machine) | The whole stack on one machine, production-style | 2 min |
| [C. Kubernetes (k3d)](#c-kubernetes-on-your-laptop-k3d) | A real cluster: replicas, probes, rolling updates, self-healing | 10 min |
| [D. A real cloud cluster](#d-moving-to-a-real-cluster) | What changes for production | — |

```
deploy/
├── compose/
│   ├── docker-compose.yml   # db, migrate, api, web, seed, nginx proxy
│   └── nginx.conf           # /api → api, / → web, SSE unbuffered
└── k8s/
    ├── kustomization.yaml   # entry point: kubectl apply -k deploy/k8s
    ├── namespace.yaml
    ├── postgres.yaml        # StatefulSet + persistent volume + headless Service
    ├── api.yaml             # Deployment (migrations in an init container) + Service
    ├── web.yaml             # Deployment + Service
    ├── ingress.yaml         # one entry point: /api → api, / → web
    ├── seed-job.yaml        # one-off Job: load the demo workspace
    └── secrets.env.example  # template for the (git-ignored) secrets.env
```

---

## How the pieces fit

```
                 browser ── http://localhost:8080 ──┐
                                                    ▼
                                     ┌─────────── Ingress (Traefik) ───────────┐
                                     │  /api/*  ─► Service api ─► api pods ×2  │──► Service postgres ─► postgres-0
                                     │  /*      ─► Service web ─► web pods ×2  │                          │
                                     └─────────────────────────────────────────┘                  PersistentVolume
```

* **One origin.** The browser loads the UI and calls the API on the same host (`/api/...`). The
  web image is built with an empty `NEXT_PUBLIC_API_URL`, so it has no address baked in and works
  on any domain. Same origin also means no CORS setup, and cookies just work.
* **The API is stateless.** All state lives in Postgres, so API and web pods can be added,
  removed or replaced at any time.
* **Migrations run before the API starts**, in an *init container* of every API pod. A Postgres
  advisory lock makes pods that start at the same moment take turns, so the first one migrates
  and the others find nothing left to do.

---

## A. Docker images

Requirements: [Docker](https://docs.docker.com/get-docker/) (Docker Desktop on macOS/Windows).

```bash
make docker-build        # = docker build -t halo-api:local apps/api
                         #   docker build -t halo-web:local apps/web
docker image ls 'halo-*'
```

What's in the Dockerfiles (`apps/api/Dockerfile`, `apps/web/Dockerfile`):

* **Multi-stage builds.** Dependencies are installed and the app compiled in "build" stages; the
  final image gets only the result. Compilers, caches and dev dependencies never ship.
* **Layer caching.** The lockfile is copied and dependencies installed *before* the code is
  copied. Changing a line of code reuses the dependency layer, so rebuilds take seconds.
* **Non-root users with numeric UIDs** (`USER 10001`, `USER 1000`). Kubernetes can only check
  `runAsNonRoot` against a number, not a user name.
* **One process per container.** The API runs a single uvicorn process; you scale by running
  more containers, not more workers.
* **The same API image runs three things:** the server (default), migrations
  (`alembic upgrade head`) and the demo seed (`python -m app.seed`).

> **Apple Silicon → cloud:** images built on an M-series Mac are `arm64`. For x86 cloud nodes
> build with `docker buildx build --platform linux/amd64 ...`.

---

## B. Docker Compose (one machine)

```bash
make compose-up          # writes deploy/compose/.env with a random JWT secret (once),
                         # builds the images, starts everything, loads the demo workspace
open http://localhost:8080          # demo@halo.dev / demo1234
```

Startup order is driven by health checks: `db` healthy → `migrate` runs and exits →
`api` healthy (`/api/v1/health/ready`) → `web` → `proxy`.

```bash
cd deploy/compose
docker compose ps                   # status of each service
docker compose logs -f api          # follow the API logs
docker compose down                 # stop (add -v to also delete the database volume)
```

Differences from `make dev`: no hot reload, `ENV=prod` (`/demo/reset` disabled, a real
`JWT_SECRET` required), and everything behind one nginx origin, the same shape as production.

---

## C. Kubernetes on your laptop (k3d)

[k3d](https://k3d.io) runs [k3s](https://k3s.io), a lightweight but fully conformant Kubernetes,
inside Docker. It comes with the Traefik ingress controller, so there's nothing else to install.

### Install the tools

```bash
# macOS
brew install k3d kubectl
# Linux
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
# kubectl for any OS: https://kubernetes.io/docs/tasks/tools/
```

Give Docker at least 4 GB of memory (Docker Desktop → Settings → Resources).

### Deploy, step by step

```bash
make docker-build    # 1. build the images
make k3d-up          # 2. create the cluster; its ingress is published on localhost:8080
make k3d-load        # 3. copy the images into the cluster (no registry needed locally)
make k8s-secrets     # 4. write deploy/k8s/secrets.env with random passwords (git-ignored)
make k8s-deploy      # 5. kubectl apply -k deploy/k8s, then wait until everything is ready
make k8s-seed        # 6. run the one-off seed Job (demo workspace)
open http://localhost:8080
```

What step 5 creates, in order of dependency:

| Object | Name | Why |
|---|---|---|
| Namespace | `halo` | Groups everything; `kubectl delete ns halo` removes it all |
| ConfigMap | `halo-config` | Non-secret settings → environment variables (`ENV`, `LLM_PROVIDER`, …) |
| Secret | `halo-secrets` | Passwords and keys from `secrets.env` → environment variables |
| StatefulSet + PVC | `postgres` | Database with a stable identity and its own 1 Gi disk |
| Deployment | `api` (2 pods) | Init container runs migrations; probes gate traffic |
| Deployment | `web` (2 pods) | Next.js standalone server |
| Services | `api`, `web`, `postgres` | Stable DNS names + load balancing across pods |
| Ingress | `halo` | `/api` → api, `/` → web |

### Look around

```bash
make k8s-status                                  # pods, services, ingress, volumes
kubectl -n halo get pods -o wide                 # which node runs what
kubectl -n halo logs deploy/api -f               # API logs (one pod)
kubectl -n halo logs -l app=api -c migrate       # migration output of every API pod
kubectl -n halo describe pod -l app=web          # events: scheduling, probes, restarts
kubectl -n halo exec -it postgres-0 -- psql -U halo halo   # SQL shell inside the cluster
kubectl -n halo port-forward svc/api 8000:8000   # reach a Service directly, bypassing the ingress
```

### Experiments worth doing

**Self-healing.** Delete a pod and watch the Deployment replace it:
```bash
kubectl -n halo delete pod -l app=api --wait=false
kubectl -n halo get pods -w            # Ctrl-C to stop watching
```

**Persistence.** Delete the database pod. The StatefulSet recreates it, reattaches the *same*
volume, and all data is still there:
```bash
kubectl -n halo delete pod postgres-0
```

**Zero-downtime rolling update.** In one terminal, hammer the API; in another, restart it:
```bash
while true; do curl -s -o /dev/null -w "%{http_code}\n" localhost:8080/api/v1/health/ready; done
kubectl -n halo rollout restart deployment/api
```
Every response stays `200`. Three settings make that true: `maxUnavailable: 0` (new pods start
before old ones stop), the **readiness probe** (a pod gets traffic only when the database
answers), and the **`preStop` sleep**. Without the sleep, Kubernetes removes a stopping pod from
the Service at the same moment it sends SIGTERM, and the ingress keeps routing to it for a
fraction of a second. In testing that dropped about 0.5% of requests during a rollout; with it,
0 of 5,912.

**Scaling.**
```bash
kubectl -n halo scale deployment/api --replicas=4
kubectl -n halo get pods -l app=api
```
(`kubectl apply -k` puts it back to the 2 in `api.yaml`: the manifests are the source of truth.)

**Rollback.**
```bash
kubectl -n halo rollout history deployment/api
kubectl -n halo rollout undo deployment/api
```

### Shipping a code change

```bash
make docker-build && make k3d-load
kubectl -n halo rollout restart deployment/api deployment/web
```

The tag `:local` doesn't change, so Kubernetes can't tell the image is new: hence the explicit
restart. Real pipelines tag every build uniquely (usually the git SHA) and update the manifest:

```bash
docker build -t halo-api:$(git rev-parse --short HEAD) apps/api
# then set newTag for halo-api under `images:` in deploy/k8s/kustomization.yaml, by hand or with the
# standalone kustomize CLI (kubectl can only build kustomizations, not edit them):
cd deploy/k8s && kustomize edit set image halo-api=halo-api:$(git rev-parse --short HEAD)
```

After changing `secrets.env` or the ConfigMap, re-apply and restart, since running pods keep the
environment they started with:
```bash
make k8s-deploy && kubectl -n halo rollout restart deployment/api
```

### Troubleshooting

| You see | Usually means | Look at |
|---|---|---|
| `ErrImagePull` / `ImagePullBackOff` | Image not in the cluster (forgot `make k3d-load`) or a different tag | `kubectl -n halo describe pod …` |
| `CreateContainerConfigError` | Missing Secret/ConfigMap key, or a `runAsNonRoot` conflict | `describe pod` events |
| `CrashLoopBackOff` | The process exits: bad `DATABASE_URL`, `JWT_SECRET` shorter than 32 chars | `kubectl -n halo logs <pod> --previous` |
| Pod `Running` but `0/1` ready | Readiness probe failing (database unreachable, migrations not run) | `describe pod`; `logs -c migrate` |
| `Init:CrashLoopBackOff` | The migration init container fails | `kubectl -n halo logs <pod> -c migrate` |
| PVC `Pending` | No storage provisioner (not an issue on k3d) | `kubectl get storageclass` |
| Agent replies arrive all at once | A proxy is buffering Server-Sent Events | Ingress controller buffering settings |

`kubectl apply` may print `configured` for the Secret and StatefulSet on every run even when
nothing changed (a client-side apply quirk). `kubectl diff -k deploy/k8s` shows real changes;
empty output means the cluster matches the manifests.

### Clean up

```bash
make k3d-down            # deletes the cluster and everything in it
```

---

## D. Moving to a real cluster

The manifests are cluster-agnostic. For a managed cluster (GKE, EKS, AKS, DigitalOcean…) change:

1. **Push images to a registry** the cluster can pull from, tagged per commit:
   ```bash
   docker buildx build --platform linux/amd64 -t ghcr.io/<you>/halo-api:<sha> --push apps/api
   cd deploy/k8s && kustomize edit set image halo-api=ghcr.io/<you>/halo-api:<sha>
   ```
   Private registry? Add an `imagePullSecret`.
2. **Use a managed database** (backups, failover, upgrades). Drop `postgres.yaml` from
   `kustomization.yaml` and point `DATABASE_URL` in the Secret at it.
3. **HTTPS.** Add a `host` and `tls` section to the Ingress (cert-manager issues Let's Encrypt
   certificates automatically), then set `COOKIE_SECURE=true` in the ConfigMap.
4. **Ingress controller.** k3s ships Traefik. Elsewhere install one (Traefik, or a Gateway API
   implementation such as Envoy Gateway) and set `ingressClassName`. Whatever you choose, make sure
   it doesn't buffer Server-Sent Events. Avoid starting new work on the community
   ingress-nginx controller: it was retired in March 2026.
5. **Secrets.** Don't keep a `secrets.env` on a laptop: use the cloud's secret manager (e.g. via
   External Secrets Operator) or encrypt them in git (Sealed Secrets, SOPS).
6. **Automate it (CI/CD).** On every merge: test → build images tagged with the SHA → push → update
   the image tag in the manifests → `kubectl apply -k` (or let Argo CD / Flux sync from git).
7. **Capacity and limits.** Size `resources` from real usage, add a HorizontalPodAutoscaler, and
   rate-limit the agent endpoints if a paid LLM is behind them.

---

## What was verified

The images, the Compose stack and the Kubernetes manifests were exercised end to end, not just
linted:

* both images build; containers run as non-root; the API refuses to start in `prod` with the
  default JWT secret;
* Compose: the full [demo script](../README.md#demo-script) passes in a real browser through the
  nginx proxy, and Server-Sent Events stream unbuffered;
* Kubernetes (k3s v1.31, the version k3d installs by default): `kubectl apply -k` → all pods
  ready; concurrent migrations from two pods applied exactly once; the full demo script passes
  through the Traefik ingress; 0 failed requests out of 5,912 during two rolling restarts;
  deleting the database pod keeps all data; deleted pods are replaced automatically.
