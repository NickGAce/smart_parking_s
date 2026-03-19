"""add integrity constraints and list indexes

Revision ID: a4d8f3b21c6e
Revises: 7c1c9a8e4d12
Create Date: 2026-03-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4d8f3b21c6e'
down_revision: Union[str, Sequence[str], None] = '7c1c9a8e4d12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_unique_constraint(
        'uq_parking_spots_lot_spot_number',
        'parking_spots',
        ['parking_lot_id', 'spot_number'],
    )
    op.create_check_constraint(
        'ck_parking_spots_spot_number_positive',
        'parking_spots',
        'spot_number > 0',
    )

    op.create_check_constraint(
        'ck_bookings_start_before_end',
        'bookings',
        'start_time < end_time',
    )

    op.create_check_constraint(
        'ck_parking_lots_total_spots_positive',
        'parking_lots',
        'total_spots > 0',
    )
    op.create_check_constraint(
        'ck_parking_lots_guest_spot_percentage_range',
        'parking_lots',
        'guest_spot_percentage >= 0 AND guest_spot_percentage <= 100',
    )

    op.create_index(
        'ix_bookings_status_start_time',
        'bookings',
        ['status', 'start_time'],
        unique=False,
    )
    op.create_index(
        'ix_bookings_status_end_time',
        'bookings',
        ['status', 'end_time'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_bookings_status_end_time', table_name='bookings')
    op.drop_index('ix_bookings_status_start_time', table_name='bookings')

    op.drop_constraint('ck_parking_lots_guest_spot_percentage_range', 'parking_lots', type_='check')
    op.drop_constraint('ck_parking_lots_total_spots_positive', 'parking_lots', type_='check')

    op.drop_constraint('ck_bookings_start_before_end', 'bookings', type_='check')

    op.drop_constraint('ck_parking_spots_spot_number_positive', 'parking_spots', type_='check')
    op.drop_constraint('uq_parking_spots_lot_spot_number', 'parking_spots', type_='unique')
