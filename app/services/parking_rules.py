from datetime import date, datetime, time, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.parking_lot import AccessMode, ParkingLot
from app.models.parking_rules import ParkingLotScheduleException, ParkingLotWorkingHour
from app.models.user import User, UserRole


def _minutes_between(start: datetime, end: datetime) -> int:
    return int((end - start).total_seconds() // 60)


def _resolve_daily_window(
    parking_lot: ParkingLot,
    booking_date: date,
) -> tuple[time, time] | None:
    exception = next((item for item in parking_lot.schedule_exceptions if item.date == booking_date), None)
    if exception is not None:
        if exception.is_closed:
            return None
        return exception.open_time, exception.close_time

    working_hour = next(
        (item for item in parking_lot.working_hours if item.day_of_week == booking_date.weekday()),
        None,
    )
    if working_hour is None:
        if not parking_lot.working_hours:
            return time(0, 0), time(23, 59, 59)
        return None
    if working_hour.is_closed:
        return None
    return working_hour.open_time, working_hour.close_time


def validate_booking_against_lot_rules(
    parking_lot: ParkingLot,
    user: User,
    start_time: datetime,
    end_time: datetime,
) -> None:
    if start_time.date() != end_time.date():
        raise HTTPException(status_code=400, detail="Booking must start and end on the same date")

    duration_minutes = _minutes_between(start_time, end_time)
    if duration_minutes < parking_lot.min_booking_minutes:
        raise HTTPException(
            status_code=400,
            detail=f"Booking duration is less than minimum ({parking_lot.min_booking_minutes} min)",
        )
    if duration_minutes > parking_lot.max_booking_minutes:
        raise HTTPException(
            status_code=400,
            detail=f"Booking duration exceeds maximum ({parking_lot.max_booking_minutes} min)",
        )
    if duration_minutes % parking_lot.booking_step_minutes != 0:
        raise HTTPException(
            status_code=400,
            detail=f"Booking duration must be a multiple of {parking_lot.booking_step_minutes} minutes",
        )

    now = datetime.utcnow()
    if start_time > now + timedelta(minutes=parking_lot.max_advance_minutes):
        raise HTTPException(
            status_code=400,
            detail=f"Booking cannot be created earlier than {parking_lot.max_advance_minutes} minutes in advance",
        )

    if parking_lot.access_mode == AccessMode.employees_only and user.role == UserRole.tenant:
        raise HTTPException(status_code=403, detail="Parking lot is available only for employees")
    if parking_lot.access_mode == AccessMode.guests_only and user.role != UserRole.tenant:
        raise HTTPException(status_code=403, detail="Parking lot is available only for guests")

    if parking_lot.allowed_user_roles and user.role not in parking_lot.allowed_user_roles:
        raise HTTPException(status_code=403, detail="User role is not allowed for this parking lot")

    window = _resolve_daily_window(parking_lot, start_time.date())
    if window is None:
        raise HTTPException(status_code=400, detail="Parking lot is closed for the selected date")

    open_time, close_time = window
    booking_start_time = start_time.time()
    booking_end_time = end_time.time()
    if booking_start_time < open_time or booking_end_time > close_time:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Booking time must be within working hours: {open_time.strftime('%H:%M')}"
                f"-{close_time.strftime('%H:%M')}"
            ),
        )


async def get_parking_lot_with_rules(session: AsyncSession, parking_lot_id: int) -> ParkingLot | None:
    result = await session.execute(
        select(ParkingLot)
        .options(
            selectinload(ParkingLot.working_hours),
            selectinload(ParkingLot.schedule_exceptions),
        )
        .where(ParkingLot.id == parking_lot_id)
    )
    return result.scalar_one_or_none()


def replace_rules(
    parking_lot: ParkingLot,
    access_mode: AccessMode,
    allowed_user_roles: list[UserRole],
    min_booking_minutes: int,
    max_booking_minutes: int,
    booking_step_minutes: int,
    max_advance_minutes: int,
    working_hours: list,
    exceptions: list,
) -> None:
    parking_lot.access_mode = access_mode
    parking_lot.allowed_user_roles = [role.value if hasattr(role, "value") else str(role) for role in allowed_user_roles]
    parking_lot.min_booking_minutes = min_booking_minutes
    parking_lot.max_booking_minutes = max_booking_minutes
    parking_lot.booking_step_minutes = booking_step_minutes
    parking_lot.max_advance_minutes = max_advance_minutes

    parking_lot.working_hours.clear()
    for item in working_hours:
        parking_lot.working_hours.append(
            ParkingLotWorkingHour(
                day_of_week=item.day_of_week,
                open_time=item.open_time,
                close_time=item.close_time,
                is_closed=item.is_closed,
            )
        )

    parking_lot.schedule_exceptions.clear()
    for item in exceptions:
        parking_lot.schedule_exceptions.append(
            ParkingLotScheduleException(
                date=item.date,
                open_time=item.open_time,
                close_time=item.close_time,
                is_closed=item.is_closed,
            )
        )
