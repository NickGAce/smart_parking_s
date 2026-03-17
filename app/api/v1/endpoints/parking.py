from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.db.session import get_session
from app.models.parking_lot import ParkingLot
from app.models.user import User, UserRole
from app.schemas.parking_lot import ParkingLotCreate, ParkingLotOut, ParkingLotUpdate

router = APIRouter(prefix="/parking", tags=["parking"])


async def _get_parking_lot_or_404(session: AsyncSession, parking_lot_id: int) -> ParkingLot:
    res = await session.execute(select(ParkingLot).where(ParkingLot.id == parking_lot_id))
    parking_lot = res.scalar_one_or_none()
    if not parking_lot:
        raise HTTPException(status_code=404, detail="ParkingLot not found")
    return parking_lot


def _is_admin(user: User) -> bool:
    return user.role == UserRole.admin


def _can_access_parking_lot(user: User, parking_lot: ParkingLot) -> bool:
    return _is_admin(user) or parking_lot.owner_id == user.id


@router.post("", response_model=ParkingLotOut, status_code=201)
async def create_parking_lot(
    payload: ParkingLotCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.owner)),
):
    parking_lot = ParkingLot(
        name=payload.name,
        address=payload.address,
        total_spots=payload.total_spots,
        guest_spot_percentage=payload.guest_spot_percentage,
        owner_id=current_user.id if current_user.role == UserRole.owner else None,
    )
    session.add(parking_lot)
    await session.commit()
    await session.refresh(parking_lot)
    return parking_lot


@router.get("", response_model=list[ParkingLotOut])
async def list_parking_lots(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(ParkingLot)

    if current_user.role == UserRole.owner:
        stmt = stmt.where(ParkingLot.owner_id == current_user.id)

    res = await session.execute(stmt)
    return res.scalars().all()


@router.get("/{parking_lot_id}", response_model=ParkingLotOut)
async def get_parking_lot(
    parking_lot_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    parking_lot = await _get_parking_lot_or_404(session, parking_lot_id)

    if current_user.role == UserRole.owner and not _can_access_parking_lot(current_user, parking_lot):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    return parking_lot


@router.patch("/{parking_lot_id}", response_model=ParkingLotOut)
async def update_parking_lot(
    parking_lot_id: int,
    payload: ParkingLotUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.owner)),
):
    parking_lot = await _get_parking_lot_or_404(session, parking_lot_id)

    if not _can_access_parking_lot(current_user, parking_lot):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(parking_lot, field, value)

    await session.commit()
    await session.refresh(parking_lot)
    return parking_lot


@router.delete("/{parking_lot_id}", status_code=204)
async def delete_parking_lot(
    parking_lot_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(require_roles(UserRole.admin, UserRole.owner)),
):
    parking_lot = await _get_parking_lot_or_404(session, parking_lot_id)

    if not _can_access_parking_lot(current_user, parking_lot):
        raise HTTPException(status_code=403, detail="Not enough permissions")

    await session.delete(parking_lot)
    await session.commit()
