from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.schemas.anomaly import AnomalyItem, RelatedEntity


@dataclass(frozen=True)
class RuleDefinition:
    code: str
    description: str


RULE_DEFINITIONS: list[RuleDefinition] = [
    RuleDefinition("user.frequent_cancellations", ">=35% отмен при минимум 5 бронированиях."),
    RuleDefinition("user.frequent_no_show", ">=20% no_show при минимум 5 бронированиях."),
    RuleDefinition(
        "user.last_minute_pattern",
        "Бронирование в последний момент: start_time - created_at <= 60 минут, доля >=50%.",
    ),
    RuleDefinition(
        "parking.occupancy_spike",
        "Последние 24 часа >=2x от среднего суточного уровня за 7 предыдущих дней.",
    ),
    RuleDefinition("parking.high_conflict_risk", "Пиковая одновременная загрузка >=90% вместимости."),
    RuleDefinition("parking.frequent_spot_blocking", "Заблокировано >=25% мест и минимум 3 места."),
]


class AnomalyDetectionService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def detect(
        self,
        period_from: datetime,
        period_to: datetime,
        parking_lot_id: int | None = None,
        user_id: int | None = None,
    ) -> list[AnomalyItem]:
        anomalies = await self._detect_user_anomalies(period_from, period_to, parking_lot_id, user_id)
        anomalies.extend(await self._detect_parking_anomalies(period_from, period_to, parking_lot_id))
        return anomalies

    async def _detect_user_anomalies(
        self,
        period_from: datetime,
        period_to: datetime,
        parking_lot_id: int | None,
        user_id: int | None,
    ) -> list[AnomalyItem]:
        stmt = (
            select(Booking.user_id, Booking.status, Booking.start_time, Booking.created_at)
            .join(ParkingSpot, ParkingSpot.id == Booking.parking_spot_id)
            .where(and_(Booking.start_time >= period_from, Booking.start_time <= period_to))
        )

        if parking_lot_id is not None:
            stmt = stmt.where(ParkingSpot.parking_lot_id == parking_lot_id)
        if user_id is not None:
            stmt = stmt.where(Booking.user_id == user_id)

        rows = (await self.session.execute(stmt)).all()

        user_stats: dict[int, dict[str, int]] = {}
        for row in rows:
            stats = user_stats.setdefault(
                row.user_id,
                {"total": 0, "cancelled": 0, "no_show": 0, "last_minute": 0},
            )
            stats["total"] += 1
            if row.status == BookingStatus.cancelled:
                stats["cancelled"] += 1
            if row.status == BookingStatus.no_show:
                stats["no_show"] += 1

            lead_minutes = (row.start_time - row.created_at).total_seconds() / 60
            if lead_minutes <= 60:
                stats["last_minute"] += 1

        anomalies: list[AnomalyItem] = []
        for uid, stats in user_stats.items():
            total = int(stats["total"])
            if total < 5:
                continue

            cancelled = int(stats["cancelled"])
            no_show = int(stats["no_show"])
            last_minute = int(stats["last_minute"])

            cancel_rate = cancelled / total
            no_show_rate = no_show / total
            last_minute_rate = last_minute / total

            if cancel_rate >= 0.35:
                anomalies.append(
                    AnomalyItem(
                        anomaly_type="user.frequent_cancellations",
                        severity="high" if cancel_rate >= 0.5 else "medium",
                        reason=f"{cancelled} из {total} бронирований отменены ({cancel_rate:.0%}).",
                        related_entity=RelatedEntity(entity_type="user", entity_id=uid),
                        metrics={"total_bookings": total, "cancelled": cancelled, "cancellation_rate": round(cancel_rate, 3)},
                    )
                )
            if no_show_rate >= 0.2:
                anomalies.append(
                    AnomalyItem(
                        anomaly_type="user.frequent_no_show",
                        severity="high" if no_show_rate >= 0.35 else "medium",
                        reason=f"{no_show} из {total} бронирований завершились как no_show ({no_show_rate:.0%}).",
                        related_entity=RelatedEntity(entity_type="user", entity_id=uid),
                        metrics={"total_bookings": total, "no_show": no_show, "no_show_rate": round(no_show_rate, 3)},
                    )
                )
            if last_minute_rate >= 0.5:
                anomalies.append(
                    AnomalyItem(
                        anomaly_type="user.last_minute_pattern",
                        severity="high" if last_minute_rate >= 0.7 else "medium",
                        reason=f"{last_minute} из {total} бронирований созданы <=60 минут до старта ({last_minute_rate:.0%}).",
                        related_entity=RelatedEntity(entity_type="user", entity_id=uid),
                        metrics={
                            "total_bookings": total,
                            "last_minute_bookings": last_minute,
                            "last_minute_rate": round(last_minute_rate, 3),
                        },
                    )
                )

        return anomalies

    async def _detect_parking_anomalies(
        self,
        period_from: datetime,
        period_to: datetime,
        parking_lot_id: int | None,
    ) -> list[AnomalyItem]:
        lots_stmt = select(ParkingLot.id, ParkingLot.name, ParkingLot.total_spots)
        if parking_lot_id is not None:
            lots_stmt = lots_stmt.where(ParkingLot.id == parking_lot_id)
        lots = (await self.session.execute(lots_stmt)).all()

        anomalies: list[AnomalyItem] = []
        for lot in lots:
            last_day_start = period_to - timedelta(days=1)
            baseline_start = period_to - timedelta(days=8)

            recent_count_stmt = (
                select(func.count(Booking.id))
                .join(ParkingSpot, ParkingSpot.id == Booking.parking_spot_id)
                .where(ParkingSpot.parking_lot_id == lot.id)
                .where(and_(Booking.start_time >= last_day_start, Booking.start_time <= period_to))
            )
            baseline_count_stmt = (
                select(func.count(Booking.id))
                .join(ParkingSpot, ParkingSpot.id == Booking.parking_spot_id)
                .where(ParkingSpot.parking_lot_id == lot.id)
                .where(and_(Booking.start_time >= baseline_start, Booking.start_time < last_day_start))
            )

            recent_count = int((await self.session.execute(recent_count_stmt)).scalar_one() or 0)
            baseline_total = int((await self.session.execute(baseline_count_stmt)).scalar_one() or 0)
            baseline_daily_avg = baseline_total / 7 if baseline_total else 0

            if baseline_daily_avg > 0 and recent_count >= max(10, int(baseline_daily_avg * 2)):
                factor = recent_count / baseline_daily_avg
                anomalies.append(
                    AnomalyItem(
                        anomaly_type="parking.occupancy_spike",
                        severity="high" if factor >= 3 else "medium",
                        reason=(
                            f"За последние 24 часа {recent_count} бронирований: это {factor:.1f}x "
                            f"от среднего за 7 предыдущих дней ({baseline_daily_avg:.1f}/день)."
                        ),
                        related_entity=RelatedEntity(entity_type="parking_lot", entity_id=lot.id, label=lot.name),
                        metrics={"recent_24h_bookings": recent_count, "baseline_daily_avg": round(baseline_daily_avg, 2)},
                    )
                )

            intervals_stmt = (
                select(Booking.start_time, Booking.end_time)
                .join(ParkingSpot, ParkingSpot.id == Booking.parking_spot_id)
                .where(ParkingSpot.parking_lot_id == lot.id)
                .where(and_(Booking.start_time >= period_from, Booking.start_time <= period_to))
                .where(Booking.status.in_([BookingStatus.pending, BookingStatus.confirmed, BookingStatus.active]))
            )
            intervals = (await self.session.execute(intervals_stmt)).all()
            peak = self._peak_overlap(intervals)
            if lot.total_spots > 0:
                conflict_ratio = peak / lot.total_spots
                if conflict_ratio >= 0.9:
                    anomalies.append(
                        AnomalyItem(
                            anomaly_type="parking.high_conflict_risk",
                            severity="high" if conflict_ratio >= 1 else "medium",
                            reason=f"Пиковая одновременная загрузка {peak}/{lot.total_spots} ({conflict_ratio:.0%}).",
                            related_entity=RelatedEntity(entity_type="parking_lot", entity_id=lot.id, label=lot.name),
                            metrics={"peak_concurrent_bookings": peak, "conflict_ratio": round(conflict_ratio, 3)},
                        )
                    )

            blocked_count_stmt = select(func.count(ParkingSpot.id)).where(
                and_(ParkingSpot.parking_lot_id == lot.id, ParkingSpot.status == SpotStatus.blocked)
            )
            blocked_count = int((await self.session.execute(blocked_count_stmt)).scalar_one() or 0)
            if lot.total_spots > 0:
                blocked_ratio = blocked_count / lot.total_spots
                if blocked_count >= 3 and blocked_ratio >= 0.25:
                    anomalies.append(
                        AnomalyItem(
                            anomaly_type="parking.frequent_spot_blocking",
                            severity="high" if blocked_ratio >= 0.4 else "medium",
                            reason=f"Сейчас заблокировано {blocked_count}/{lot.total_spots} мест ({blocked_ratio:.0%}).",
                            related_entity=RelatedEntity(entity_type="parking_lot", entity_id=lot.id, label=lot.name),
                            metrics={"blocked_spots": blocked_count, "blocked_ratio": round(blocked_ratio, 3)},
                        )
                    )

        return anomalies

    @staticmethod
    def _peak_overlap(intervals: list[tuple[datetime, datetime]]) -> int:
        points: list[tuple[datetime, int]] = []
        for start_time, end_time in intervals:
            points.append((start_time, 1))
            points.append((end_time, -1))

        points.sort(key=lambda item: (item[0], item[1]))
        active = 0
        peak = 0
        for _, delta in points:
            active += delta
            peak = max(peak, active)
        return peak


def list_anomaly_rules() -> list[str]:
    return [f"{rule.code}: {rule.description}" for rule in RULE_DEFINITIONS]
