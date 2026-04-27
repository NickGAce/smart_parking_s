from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.booking import Booking, BookingStatus
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot, SpotStatus
from app.schemas.anomaly import AnomalyItem, RelatedEntity, SeverityLevel


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
    RuleDefinition(
        "security.suspicious_access_events",
        "За период обнаружено >=3 событий доступа с неизвестными номерами (ANPR).",
    ),
    RuleDefinition(
        "booking.unusual_duration",
        "Средняя длительность бронирования в периоде существенно выше базовой (>=1.7x) и >=90 минут.",
    ),
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

    def _build_anomaly(
        self,
        *,
        anomaly_type: str,
        severity: SeverityLevel,
        reason: str,
        explanation: str,
        impact: str,
        related_metric: str,
        severity_reason: str,
        related_entity: RelatedEntity,
        metrics: dict[str, float | int | str],
    ) -> AnomalyItem:
        return AnomalyItem(
            anomaly_type=anomaly_type,
            severity=severity,
            reason=reason,
            explanation=explanation,
            recommended_action=self._resolve_recommended_action(anomaly_type, severity),
            impact=impact,
            related_metric=related_metric,
            severity_reason=severity_reason,
            related_entity=related_entity,
            metrics=metrics,
        )

    @staticmethod
    def _resolve_recommended_action(anomaly_type: str, severity: SeverityLevel) -> str:
        if anomaly_type == "user.frequent_no_show" and severity == "high":
            return "Сократить grace period и включить автоматические напоминания перед началом бронирования."
        if anomaly_type == "user.frequent_cancellations" and severity == "high":
            return "Пересмотреть правила отмены: штраф за позднюю отмену, лимиты и предупреждения."
        if anomaly_type == "parking.occupancy_spike":
            return "Включить overflow-зону или временно ограничить гостевые бронирования в пиковые часы."
        if anomaly_type == "security.suspicious_access_events":
            return "Проверить неизвестные номера, усилить ручную верификацию и эскалацию охране."
        if anomaly_type == "booking.unusual_duration":
            return "Проверить max duration rules и ограничения по длительным бронированиям."
        if anomaly_type == "parking.high_conflict_risk":
            return "Перенастроить квоты и автоназначение для снижения пиковых конфликтов за места."
        if anomaly_type == "parking.frequent_spot_blocking":
            return "Проверить причины блокировок и вернуть доступность мест в эксплуатационный пул."
        if anomaly_type == "user.last_minute_pattern":
            return "Ввести предиктивные напоминания и приоритизировать автоназначение при late-booking."
        if anomaly_type == "user.frequent_no_show":
            return "Усилить коммуникацию перед заездом и контролировать повторные незаезды пользователя."
        if anomaly_type == "user.frequent_cancellations":
            return "Провести коммуникацию с пользователем и мониторить динамику отмен по периодам."
        return "Провести операционную проверку и применить корректирующие меры по регламенту."

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
                severity: SeverityLevel = "high" if cancel_rate >= 0.5 else "medium"
                anomalies.append(
                    self._build_anomaly(
                        anomaly_type="user.frequent_cancellations",
                        severity=severity,
                        reason=f"{cancelled} из {total} бронирований отменены ({cancel_rate:.0%}).",
                        explanation="Пользователь системно отменяет бронирования чаще, чем допускает операционный порог.",
                        impact="Рост волатильности спроса и менее предсказуемая загрузка парковки.",
                        related_metric="cancellation_rate",
                        severity_reason=(
                            f"Уровень {severity}: доля отмен {cancel_rate:.1%} "
                            f"{'существенно выше' if severity == 'high' else 'выше'} порога 35%."
                        ),
                        related_entity=RelatedEntity(entity_type="user", entity_id=uid),
                        metrics={"total_bookings": total, "cancelled": cancelled, "cancellation_rate": round(cancel_rate, 3)},
                    )
                )
            if no_show_rate >= 0.2:
                severity = "high" if no_show_rate >= 0.35 else "medium"
                anomalies.append(
                    self._build_anomaly(
                        anomaly_type="user.frequent_no_show",
                        severity=severity,
                        reason=f"{no_show} из {total} бронирований завершились как no_show ({no_show_rate:.0%}).",
                        explanation="Высокая доля незаездов говорит о недисциплинированном паттерне использования мест.",
                        impact="Места остаются заблокированными в графике, снижая доступность для других пользователей.",
                        related_metric="no_show_rate",
                        severity_reason=(
                            f"Уровень {severity}: no-show {no_show_rate:.1%} "
                            f"{'существенно выше' if severity == 'high' else 'выше'} порога 20%."
                        ),
                        related_entity=RelatedEntity(entity_type="user", entity_id=uid),
                        metrics={"total_bookings": total, "no_show": no_show, "no_show_rate": round(no_show_rate, 3)},
                    )
                )
            if last_minute_rate >= 0.5:
                severity = "high" if last_minute_rate >= 0.7 else "medium"
                anomalies.append(
                    self._build_anomaly(
                        anomaly_type="user.last_minute_pattern",
                        severity=severity,
                        reason=f"{last_minute} из {total} бронирований созданы <=60 минут до старта ({last_minute_rate:.0%}).",
                        explanation="Пользователь формирует спрос в последний момент, усложняя планирование загрузки.",
                        impact="Повышается риск дефицита свободных мест и локальных конфликтов в пиковые окна.",
                        related_metric="last_minute_rate",
                        severity_reason=(
                            f"Уровень {severity}: доля late-booking {last_minute_rate:.1%} "
                            f"{'значительно выше' if severity == 'high' else 'выше'} порога 50%."
                        ),
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
                severity = "high" if factor >= 3 else "medium"
                anomalies.append(
                    self._build_anomaly(
                        anomaly_type="parking.occupancy_spike",
                        severity=severity,
                        reason=(
                            f"За последние 24 часа {recent_count} бронирований: это {factor:.1f}x "
                            f"от среднего за 7 предыдущих дней ({baseline_daily_avg:.1f}/день)."
                        ),
                        explanation="Резкий всплеск бронирований указывает на кратковременную перегрузку контура.",
                        impact="Вырастает риск отказов при размещении и операционных задержек в пиковые часы.",
                        related_metric="recent_24h_bookings",
                        severity_reason=(
                            f"Уровень {severity}: коэффициент всплеска {factor:.2f}x "
                            f"{'превышает' if severity == 'high' else 'близок к'} критический порог 3x."
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
                    severity = "high" if conflict_ratio >= 1 else "medium"
                    anomalies.append(
                        self._build_anomaly(
                            anomaly_type="parking.high_conflict_risk",
                            severity=severity,
                            reason=f"Пиковая одновременная загрузка {peak}/{lot.total_spots} ({conflict_ratio:.0%}).",
                            explanation="Одновременные бронирования приближаются к полной вместимости парковки.",
                            impact="Система теряет запас емкости и чаще сталкивается с конфликтами за места.",
                            related_metric="conflict_ratio",
                            severity_reason=(
                                f"Уровень {severity}: доля пикового конфликта {conflict_ratio:.1%} "
                                f"{'достигла' if severity == 'high' else 'приблизилась к'} полной загрузки."
                            ),
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
                    severity = "high" if blocked_ratio >= 0.4 else "medium"
                    anomalies.append(
                        self._build_anomaly(
                            anomaly_type="parking.frequent_spot_blocking",
                            severity=severity,
                            reason=f"Сейчас заблокировано {blocked_count}/{lot.total_spots} мест ({blocked_ratio:.0%}).",
                            explanation="Слишком много мест выведено из оборота, что снижает эксплуатационную емкость.",
                            impact="Падает реальная доступность мест и растет давление на оставшиеся зоны.",
                            related_metric="blocked_ratio",
                            severity_reason=(
                                f"Уровень {severity}: доля заблокированных мест {blocked_ratio:.1%} "
                                f"{'существенно выше' if severity == 'high' else 'выше'} рабочего порога 25%."
                            ),
                            related_entity=RelatedEntity(entity_type="parking_lot", entity_id=lot.id, label=lot.name),
                            metrics={"blocked_spots": blocked_count, "blocked_ratio": round(blocked_ratio, 3)},
                        )
                    )

            unknown_plate_events = await self._unknown_plate_events(lot.id, period_from, period_to)
            if unknown_plate_events >= 3:
                severity = "high" if unknown_plate_events >= 7 else "medium"
                anomalies.append(
                    self._build_anomaly(
                        anomaly_type="security.suspicious_access_events",
                        severity=severity,
                        reason=f"За период обнаружено {unknown_plate_events} событий доступа с неизвестными номерами.",
                        explanation="ANPR/журнал доступа фиксирует повторяющиеся события с неизвестными номерами.",
                        impact="Повышается риск несанкционированного въезда и инцидентов безопасности.",
                        related_metric="unknown_plate_events",
                        severity_reason=(
                            f"Уровень {severity}: {unknown_plate_events} событий "
                            f"{'значительно превышают' if severity == 'high' else 'превышают'} порог 3."
                        ),
                        related_entity=RelatedEntity(entity_type="parking_lot", entity_id=lot.id, label=lot.name),
                        metrics={"unknown_plate_events": unknown_plate_events},
                    )
                )

            duration_anomaly = await self._detect_unusual_booking_duration(lot.id, lot.name, period_from, period_to)
            if duration_anomaly is not None:
                anomalies.append(duration_anomaly)

        return anomalies

    async def _detect_unusual_booking_duration(
        self,
        lot_id: int,
        lot_name: str,
        period_from: datetime,
        period_to: datetime,
    ) -> AnomalyItem | None:
        baseline_from = period_from - timedelta(days=14)
        baseline_to = period_from

        current_stmt = (
            select(Booking.start_time, Booking.end_time)
            .join(ParkingSpot, ParkingSpot.id == Booking.parking_spot_id)
            .where(ParkingSpot.parking_lot_id == lot_id)
            .where(and_(Booking.start_time >= period_from, Booking.start_time <= period_to))
        )
        baseline_stmt = (
            select(Booking.start_time, Booking.end_time)
            .join(ParkingSpot, ParkingSpot.id == Booking.parking_spot_id)
            .where(ParkingSpot.parking_lot_id == lot_id)
            .where(and_(Booking.start_time >= baseline_from, Booking.start_time < baseline_to))
        )

        current_rows = (await self.session.execute(current_stmt)).all()
        baseline_rows = (await self.session.execute(baseline_stmt)).all()

        if len(current_rows) < 5 or len(baseline_rows) < 5:
            return None

        current_avg = self._avg_duration_minutes(current_rows)
        baseline_avg = self._avg_duration_minutes(baseline_rows)
        if baseline_avg <= 0:
            return None

        factor = current_avg / baseline_avg
        if current_avg < 90 or factor < 1.7:
            return None

        severity: SeverityLevel = "high" if factor >= 2.2 else "medium"
        return self._build_anomaly(
            anomaly_type="booking.unusual_duration",
            severity=severity,
            reason=(
                f"Средняя длительность бронирования {current_avg:.1f} мин, "
                f"это {factor:.1f}x к базовому уровню {baseline_avg:.1f} мин."
            ),
            explanation="Пользователи начали занимать места существенно дольше обычного профиля.",
            impact="Снижается оборачиваемость парковочных мест и растет вероятность дефицита в течение дня.",
            related_metric="average_booking_duration_minutes",
            severity_reason=(
                f"Уровень {severity}: длительность {current_avg:.1f} мин при коэффициенте {factor:.2f}x "
                f"к историческому baseline."
            ),
            related_entity=RelatedEntity(entity_type="parking_lot", entity_id=lot_id, label=lot_name),
            metrics={
                "avg_duration_minutes": round(current_avg, 2),
                "baseline_avg_duration_minutes": round(baseline_avg, 2),
                "duration_factor": round(factor, 3),
            },
        )

    async def _unknown_plate_events(self, lot_id: int, period_from: datetime, period_to: datetime) -> int:
        stmt = (
            select(AuditLog)
            .where(AuditLog.timestamp >= period_from)
            .where(AuditLog.timestamp <= period_to)
            .where(AuditLog.entity_type == "parking_lot")
            .where(AuditLog.entity_id == str(lot_id))
        )
        logs = (await self.session.execute(stmt)).scalars().all()
        count = 0
        for log in logs:
            action = (log.action_type or "").lower()
            metadata = log.source_metadata or {}
            new_values = log.new_values or {}
            if "unknown_plate" in action:
                count += 1
                continue
            if "anpr" in action and (
                metadata.get("unknown_plate") is True
                or metadata.get("plate_status") == "unknown"
                or new_values.get("plate_status") == "unknown"
            ):
                count += 1
        return count

    @staticmethod
    def _avg_duration_minutes(intervals: list[tuple[datetime, datetime]]) -> float:
        total_minutes = 0.0
        for start_time, end_time in intervals:
            total_minutes += max((end_time - start_time).total_seconds() / 60, 0)
        return total_minutes / len(intervals) if intervals else 0

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
