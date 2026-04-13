from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking
from app.models.notification import Notification, NotificationStatus, NotificationType


@dataclass(slots=True)
class NotificationPayload:
    user_id: int
    type: NotificationType
    title: str
    message: str
    booking_id: int | None = None


class NotificationChannel:
    async def deliver(self, notification: Notification) -> None:
        """External delivery side-effect (email/push/ws)."""


class InboxChannel(NotificationChannel):
    async def deliver(self, notification: Notification) -> None:  # pragma: no cover - no side-effects yet
        return None


class NotificationService:
    def __init__(self, channels: list[NotificationChannel] | None = None):
        self.channels = channels or [InboxChannel()]

    async def create_notification(self, session: AsyncSession, payload: NotificationPayload) -> Notification:
        notification = Notification(
            user_id=payload.user_id,
            booking_id=payload.booking_id,
            type=payload.type,
            title=payload.title,
            message=payload.message,
        )
        session.add(notification)
        await session.flush()

        for channel in self.channels:
            await channel.deliver(notification)

        notification.delivered_at = datetime.utcnow()
        return notification

    async def create_for_booking_event(
        self,
        session: AsyncSession,
        booking: Booking,
        event_type: NotificationType,
        title: str,
        message: str,
    ) -> Notification:
        return await self.create_notification(
            session,
            NotificationPayload(
                user_id=booking.user_id,
                booking_id=booking.id,
                type=event_type,
                title=title,
                message=message,
            ),
        )

    async def create_booking_starts_soon_if_missing(self, session: AsyncSession, booking: Booking) -> bool:
        existing = await session.execute(
            select(Notification.id)
            .where(Notification.booking_id == booking.id)
            .where(Notification.type == NotificationType.booking_starts_soon)
            .limit(1)
        )
        if existing.scalar_one_or_none() is not None:
            return False

        await self.create_for_booking_event(
            session=session,
            booking=booking,
            event_type=NotificationType.booking_starts_soon,
            title="Booking starts soon",
            message=f"Booking #{booking.id} starts at {booking.start_time.isoformat()}.",
        )
        return True


notification_service = NotificationService()
