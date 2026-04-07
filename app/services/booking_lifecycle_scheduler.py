from __future__ import annotations

import asyncio
import logging
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.services.booking_lifecycle import run_booking_lifecycle_sync

logger = logging.getLogger(__name__)


class BookingLifecycleScheduler:
    """Lightweight in-process scheduler for periodic booking lifecycle sync."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        interval_seconds: int,
        enabled: bool = True,
        run_on_startup: bool = True,
    ) -> None:
        self._session_factory = session_factory
        self._interval_seconds = interval_seconds
        self._enabled = enabled
        self._run_on_startup = run_on_startup
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if not self._enabled:
            logger.info("Booking lifecycle scheduler is disabled")
            return

        if self._task is not None and not self._task.done():
            return

        self._stop_event.clear()
        self._task = asyncio.create_task(self._runner(), name="booking-lifecycle-sync")

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _runner(self) -> None:
        if self._run_on_startup:
            await self._run_once()

        while not self._stop_event.is_set():
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self._interval_seconds)
                break
            except asyncio.TimeoutError:
                await self._run_once()

    async def _run_once(self) -> None:
        try:
            async with self._session_factory() as session:
                async with session.begin():
                    stats = await run_booking_lifecycle_sync(session)

            logger.info(
                "Booking lifecycle sync finished: expired=%s completed=%s no_show=%s spot_available=%s spot_booked=%s",
                stats.expired,
                stats.completed,
                stats.no_show,
                stats.spot_available,
                stats.spot_booked,
            )
        except Exception:
            logger.exception("Booking lifecycle sync failed")
