from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.router import router as v1_router
from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.services.booking_lifecycle_scheduler import BookingLifecycleScheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler = BookingLifecycleScheduler(
        session_factory=AsyncSessionLocal,
        interval_seconds=settings.booking_sync_interval_seconds,
        enabled=settings.booking_sync_enabled,
        run_on_startup=settings.booking_sync_run_on_startup,
    )
    await scheduler.start()
    app.state.booking_lifecycle_scheduler = scheduler
    try:
        yield
    finally:
        await scheduler.stop()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.include_router(v1_router)
