from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import uuid4

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.booking import Booking, BookingStatus
from app.models.parking_lot import ParkingLot
from app.models.parking_spot import ParkingSpot
from app.models.user import UserRole
from app.schemas.analytics import ManagementRecommendationOut, ManagementSeverity
from app.services.analytics import AnalyticsFilters, get_booking_metrics, get_occupancy_by_zone, get_occupancy_percent
from app.services.anomaly_detection import AnomalyDetectionService


@dataclass
class ManagementRecommendationFilters:
    period_from: datetime
    period_to: datetime
    parking_lot_id: int | None = None
    severity: ManagementSeverity | None = None


class ManagementRecommendationsService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_recommendations(
        self,
        filters: ManagementRecommendationFilters,
        current_user_id: int,
        current_user_role: str,
    ) -> list[ManagementRecommendationOut]:
        scoped_lot_ids = await self._resolve_scoped_lot_ids(current_user_id, current_user_role, filters.parking_lot_id)
        if not scoped_lot_ids:
            return []

        recommendations: list[ManagementRecommendationOut] = []
        anomaly_service = AnomalyDetectionService(self.session)
        anomalies = await anomaly_service.detect(
            period_from=filters.period_from,
            period_to=filters.period_to,
            parking_lot_id=filters.parking_lot_id,
            user_id=None,
        )

        for lot_id in scoped_lot_ids:
            analytics_filters = AnalyticsFilters(
                parking_lot_id=lot_id,
                zone=None,
                period="custom",
                from_time=filters.period_from,
                to_time=filters.period_to,
            )
            occupancy_percent = await get_occupancy_percent(self.session, analytics_filters)
            zone_occupancy = await get_occupancy_by_zone(self.session, analytics_filters)
            booking_metrics = await get_booking_metrics(self.session, analytics_filters)
            recent_cancelled, previous_cancelled = await self._cancel_growth(lot_id, filters.period_from, filters.period_to)
            unknown_plate_events = await self._unknown_plate_events(lot_id, filters.period_from, filters.period_to)

            if occupancy_percent >= 85:
                recommendations.append(
                    self._build_item(
                        lot_id=lot_id,
                        rec_type="overload",
                        severity="critical" if occupancy_percent >= 95 else "high",
                        title="Перегрузка парковки",
                        description="Обнаружена высокая средняя загрузка парковки за выбранный период.",
                        recommended_action="Перераспределите поток в менее загруженные зоны и временно ограничьте гостевые бронирования в пиковые часы.",
                        metric_source="Аналитика загрузки парковки",
                        evidence=f"Средняя загрузка: {occupancy_percent:.2f}%",
                        expected_effect="Снижение конфликтов за места и стабилизация SLA по доступности.",
                    )
                )

            if booking_metrics.no_show_rate >= 0.15:
                recommendations.append(
                    self._build_item(
                        lot_id=lot_id,
                        rec_type="no_show",
                        severity="high" if booking_metrics.no_show_rate >= 0.25 else "medium",
                        title="Высокий уровень неявок",
                        description="Доля бронирований со статусом «неявка» превышает допустимый операционный порог.",
                        recommended_action="Сократите период ожидания прибытия и включите автоотмену неактивированных бронирований.",
                        metric_source="Аналитика бронирований",
                        evidence=f"Доля неявок: {booking_metrics.no_show_rate:.2%}",
                        expected_effect="Увеличение доступности мест и снижение пустых простоев в занятом расписании.",
                    )
                )

            if recent_cancelled > previous_cancelled and booking_metrics.cancellation_rate >= 0.12:
                recommendations.append(
                    self._build_item(
                        lot_id=lot_id,
                        rec_type="cancellation",
                        severity="high" if booking_metrics.cancellation_rate >= 0.2 else "medium",
                        title="Рост отмен бронирований",
                        description="Количество отмен в последней части периода выше, чем в предыдущей.",
                        recommended_action="Пересмотрите правила бронирования: штрафы за позднюю отмену, минимальное окно предупреждения, лимиты частых отмен.",
                        metric_source="Аналитика бронирований и тренд отмен",
                        evidence=(
                            f"Доля отмен: {booking_metrics.cancellation_rate:.2%}. "
                            f"Последняя половина периода: {recent_cancelled}, предыдущая: {previous_cancelled}."
                        ),
                        expected_effect="Снижение волатильности спроса и более предсказуемая загрузка.",
                    )
                )

            if zone_occupancy:
                min_zone = min(zone_occupancy, key=lambda item: float(item["occupancy_percent"]))
                max_zone = max(zone_occupancy, key=lambda item: float(item["occupancy_percent"]))
                min_value = float(min_zone["occupancy_percent"])
                max_value = float(max_zone["occupancy_percent"])

                if min_value <= 25:
                    recommendations.append(
                        self._build_item(
                            lot_id=lot_id,
                            rec_type="underutilization",
                            severity="medium" if min_value <= 15 else "low",
                            title="Недоиспользуемая зона",
                            description="Одна из зон системно простаивает и не участвует в утилизации спроса.",
                            recommended_action="Используйте зону как резервный контур для пиковых периодов и направляйте туда динамические назначения.",
                            metric_source="Загрузка по зонам",
                            evidence=f"Зона «{min_zone['zone']}»: загрузка {min_value:.2f}%",
                            expected_effect="Рост общей утилизации и уменьшение локальных перегрузок.",
                        )
                    )

                if (max_value - min_value) >= 40 and max_value >= 75:
                    recommendations.append(
                        self._build_item(
                            lot_id=lot_id,
                            rec_type="zone_imbalance",
                            severity="high" if (max_value - min_value) >= 55 else "medium",
                            title="Дисбаланс между зонами",
                            description="Нагрузка распределяется неравномерно: часть зон перегружена при простое других.",
                            recommended_action="Перенастройте правила маршрутизации и квоты, чтобы выровнять поток между зонами.",
                            metric_source="Загрузка по зонам",
                            evidence=(
                                f"Максимум: «{max_zone['zone']}» ({max_value:.2f}%), "
                                f"минимум: «{min_zone['zone']}» ({min_value:.2f}%)."
                            ),
                            expected_effect="Балансировка спроса и снижение риска отказов при размещении.",
                        )
                    )

            frequent_cancellation_anomaly = next(
                (item for item in anomalies if item.anomaly_type == "user.frequent_cancellations"),
                None,
            )
            if frequent_cancellation_anomaly is not None:
                recommendations.append(
                    self._build_item(
                        lot_id=lot_id,
                        rec_type="rule_change",
                        severity="high",
                        title="Требуется корректировка правил",
                        description="Аномалии подтверждают нестабильное поведение пользователей в бронированиях.",
                        recommended_action="Обновите политику: ужесточите правила поздней отмены и добавьте ограничения для повторяющихся нарушителей.",
                        metric_source="Сигналы аномалий",
                        evidence=frequent_cancellation_anomaly.reason,
                        expected_effect="Снижение числа повторных злоупотреблений и повышение дисциплины бронирований.",
                    )
                )

            if unknown_plate_events >= 5:
                recommendations.append(
                    self._build_item(
                        lot_id=lot_id,
                        rec_type="security",
                        severity="critical" if unknown_plate_events >= 10 else "high",
                        title="Повышенный риск доступа",
                        description="После работы системы распознавания номеров фиксируется значимое число событий с неизвестными номерами.",
                        recommended_action="Усилите контроль доступа: ручная верификация, белые/черные списки номеров, оповещение охраны при повторных событиях с неизвестными номерами.",
                        metric_source="Журнал событий доступа (системы распознавания номеров)",
                        evidence=f"События с неизвестными номерами: {unknown_plate_events}",
                        expected_effect="Снижение числа неавторизованных въездов и ускорение реакции службы охраны.",
                    )
                )

        if filters.severity is not None:
            recommendations = [item for item in recommendations if item.severity == filters.severity]

        return recommendations

    async def _resolve_scoped_lot_ids(self, user_id: int, role: str, parking_lot_id: int | None) -> list[int]:
        stmt = select(ParkingLot.id)
        if parking_lot_id is not None:
            stmt = stmt.where(ParkingLot.id == parking_lot_id)
        if role == UserRole.owner:
            stmt = stmt.where(ParkingLot.owner_id == user_id)
        rows = (await self.session.execute(stmt)).all()
        return [int(row.id) for row in rows]

    async def _cancel_growth(self, lot_id: int, period_from: datetime, period_to: datetime) -> tuple[int, int]:
        midpoint = period_from + ((period_to - period_from) / 2)
        previous_stmt = (
            select(Booking.id)
            .join(ParkingSpot, Booking.parking_spot_id == ParkingSpot.id)
            .where(ParkingSpot.parking_lot_id == lot_id)
            .where(and_(Booking.status == BookingStatus.cancelled, Booking.start_time >= period_from, Booking.start_time < midpoint))
        )
        recent_stmt = (
            select(Booking.id)
            .join(ParkingSpot, Booking.parking_spot_id == ParkingSpot.id)
            .where(ParkingSpot.parking_lot_id == lot_id)
            .where(and_(Booking.status == BookingStatus.cancelled, Booking.start_time >= midpoint, Booking.start_time <= period_to))
        )
        previous = len((await self.session.execute(previous_stmt)).all())
        recent = len((await self.session.execute(recent_stmt)).all())
        return recent, previous

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

    def _build_item(
        self,
        lot_id: int,
        rec_type: str,
        severity: ManagementSeverity,
        title: str,
        description: str,
        recommended_action: str,
        metric_source: str,
        evidence: str,
        expected_effect: str,
    ) -> ManagementRecommendationOut:
        return ManagementRecommendationOut(
            id=f"mr-{lot_id}-{rec_type}-{uuid4().hex[:8]}",
            type=rec_type,
            severity=severity,
            title=title,
            description=description,
            recommended_action=recommended_action,
            metric_source=metric_source,
            evidence=evidence,
            expected_effect=expected_effect,
            created_at=datetime.utcnow(),
        )
