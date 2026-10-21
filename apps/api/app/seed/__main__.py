import asyncio
import time

from sqlalchemy import func, select

from app.db import default_sessionmaker
from app.models import Activity, Company, Contact, Deal, Task
from app.seed.demo import DEMO_EMAIL, DEMO_PASSWORD, reset_demo


async def main() -> None:
    started = time.perf_counter()
    async with default_sessionmaker()() as session:
        workspace = await reset_demo(session)
        await session.commit()
        counts = {}
        for model in (Company, Contact, Deal, Task, Activity):
            counts[model.__tablename__] = await session.scalar(
                select(func.count()).select_from(model).where(model.workspace_id == workspace.id)
            )
    took = time.perf_counter() - started
    summary = ", ".join(f"{v} {k}" for k, v in counts.items())
    print(f"Seeded demo workspace in {took:.1f}s: {summary}")
    print(f"Sign in with {DEMO_EMAIL} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
