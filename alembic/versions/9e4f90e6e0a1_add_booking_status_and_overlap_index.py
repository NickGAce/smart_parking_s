"""add booking status and overlap index

Revision ID: 9e4f90e6e0a1
Revises: 67e8233488d6
Create Date: 2026-03-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e4f90e6e0a1'
down_revision: Union[str, Sequence[str], None] = '67e8233488d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


booking_status_enum = sa.Enum(
    'active', 'cancelled', 'completed', 'expired', name='bookingstatus'
)


def upgrade() -> None:
    """Upgrade schema."""
    booking_status_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'bookings',
        sa.Column('status', booking_status_enum, nullable=False, server_default='active'),
    )
    op.create_index(
        'ix_bookings_spot_time_status',
        'bookings',
        ['parking_spot_id', 'start_time', 'end_time', 'status'],
        unique=False,
    )
    op.alter_column('bookings', 'status', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_bookings_spot_time_status', table_name='bookings')
    op.drop_column('bookings', 'status')
    booking_status_enum.drop(op.get_bind(), checkfirst=True)
