# Halo CRM API image.
#   docker build -t halo-api apps/api
# The same image runs the server (default CMD), migrations (`alembic upgrade head`)
# and the demo seed (`python -m app.seed`).

# ---- build stage: resolve and install dependencies into /app/.venv --------------------------
FROM python:3.12-slim AS build

# uv: a fast, lockfile-exact installer (pinned to the version the project uses).
RUN pip install --no-cache-dir uv==0.11.32

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app
# Only the dependency manifests: this layer is rebuilt only when the lockfile changes,
# so editing code doesn't reinstall every package.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# ---- runtime stage: just Python, the virtualenv and the code ---------------------------------
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app
COPY --from=build /app/.venv /app/.venv
COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

# Never run as root inside the container.
RUN useradd --system --uid 10001 --no-create-home halo
USER 10001

EXPOSE 8000

# One process per container; scale with more containers/pods instead of workers.
# --proxy-headers: trust X-Forwarded-* from the reverse proxy / ingress in front.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips", "*"]
