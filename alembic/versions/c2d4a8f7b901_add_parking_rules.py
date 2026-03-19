"""add parking rules

Revision ID: c2d4a8f7b901
Revises: bb1f8f0b8a21
Create Date: 2026-03-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2d4a8f7b901'
down_revision: Union[str, Sequence[str], None] = 'bb1f8f0b8a21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


accessmode_enum = sa.Enum('employees_only', 'guests_only', 'mixed', name='accessmode')


def upgrade() -> None:
    bind = op.get_bind()
    accessmode_enum.create(bind, checkfirst=True)

    op.add_column('parking_lots', sa.Column('access_mode', accessmode_enum, nullable=False, server_default='mixed'))
    op.add_column('parking_lots', sa.Column('allowed_user_roles', sa.JSON(), nullable=False, server_default='[]'))
    op.add_column('parking_lots', sa.Column('min_booking_minutes', sa.Integer(), nullable=False, server_default='30'))
    op.add_column('parking_lots', sa.Column('max_booking_minutes', sa.Integer(), nullable=False, server_default='720'))
    op.add_column('parking_lots', sa.Column('booking_step_minutes', sa.Integer(), nullable=False, server_default='30'))
    op.add_column('parking_lots', sa.Column('max_advance_minutes', sa.Integer(), nullable=False, server_default='10080'))

    op.create_check_constraint(
        'ck_parking_lots_min_booking_minutes_positive',
        'parking_lots',
        'min_booking_minutes > 0',
    )
    op.create_check_constraint(
        'ck_parking_lots_max_booking_minutes_positive',
        'parking_lots',
        'max_booking_minutes > 0',
    )
    op.create_check_constraint(
        'ck_parking_lots_booking_min_lte_max',
        'parking_lots',
        'min_booking_minutes <= max_booking_minutes',
    )
    op.create_check_constraint(
        'ck_parking_lots_booking_step_minutes_positive',
        'parking_lots',
        'booking_step_minutes > 0',
    )
    op.create_check_constraint(
        'ck_parking_lots_max_advance_minutes_positive',
        'parking_lots',
        'max_advance_minutes > 0',
    )

    op.alter_column('parking_lots', 'access_mode', server_default=None)
    op.alter_column('parking_lots', 'allowed_user_roles', server_default=None)
    op.alter_column('parking_lots', 'min_booking_minutes', server_default=None)
    op.alter_column('parking_lots', 'max_booking_minutes', server_default=None)
    op.alter_column('parking_lots', 'booking_step_minutes', server_default=None)
    op.alter_column('parking_lots', 'max_advance_minutes', server_default=None)

    op.create_table(
        'parking_lot_working_hours',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('parking_lot_id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('open_time', sa.Time(), nullable=True),
        sa.Column('close_time', sa.Time(), nullable=True),
        sa.Column('is_closed', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(['parking_lot_id'], ['parking_lots.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('parking_lot_id', 'day_of_week', name='uq_working_hours_lot_day'),
        sa.CheckConstraint('day_of_week >= 0 AND day_of_week <= 6', name='ck_working_hours_day_of_week_range'),
    )
    op.create_table(
        'parking_lot_schedule_exceptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('parking_lot_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('open_time', sa.Time(), nullable=True),
        sa.Column('close_time', sa.Time(), nullable=True),
        sa.Column('is_closed', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.ForeignKeyConstraint(['parking_lot_id'], ['parking_lots.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('parking_lot_id', 'date', name='uq_schedule_exceptions_lot_date'),
    )


def downgrade() -> None:
    op.drop_table('parking_lot_schedule_exceptions')
    op.drop_table('parking_lot_working_hours')

    op.drop_constraint('ck_parking_lots_max_advance_minutes_positive', 'parking_lots', type_='check')
    op.drop_constraint('ck_parking_lots_booking_step_minutes_positive', 'parking_lots', type_='check')
    op.drop_constraint('ck_parking_lots_booking_min_lte_max', 'parking_lots', type_='check')
    op.drop_constraint('ck_parking_lots_max_booking_minutes_positive', 'parking_lots', type_='check')
    op.drop_constraint('ck_parking_lots_min_booking_minutes_positive', 'parking_lots', type_='check')

    op.drop_column('parking_lots', 'max_advance_minutes')
    op.drop_column('parking_lots', 'booking_step_minutes')
    op.drop_column('parking_lots', 'max_booking_minutes')
    op.drop_column('parking_lots', 'min_booking_minutes')
    op.drop_column('parking_lots', 'allowed_user_roles')
    op.drop_column('parking_lots', 'access_mode')

    bind = op.get_bind()
    accessmode_enum.drop(bind, checkfirst=True)
