"""expand parking spot domain model

Revision ID: bb1f8f0b8a21
Revises: a4d8f3b21c6e
Create Date: 2026-03-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'bb1f8f0b8a21'
down_revision: Union[str, Sequence[str], None] = 'a4d8f3b21c6e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


spot_type_enum = postgresql.ENUM('regular', 'guest', 'disabled', 'ev', 'reserved', 'vip', name='spottype')
vehicle_type_enum = postgresql.ENUM('car', 'bike', 'truck', name='vehicletype')
size_category_enum = postgresql.ENUM('small', 'medium', 'large', name='sizecategory')
zone_type_enum = postgresql.ENUM('general', 'premium', 'service', 'restricted', name='zonetype')
access_level_enum = postgresql.ENUM('public', 'employees', 'permit_only', 'vip_only', name='accesslevel')

# prevent duplicate CREATE TYPE during table/column creation on PostgreSQL
spot_type_enum_col = postgresql.ENUM('regular', 'guest', 'disabled', 'ev', 'reserved', 'vip', name='spottype', create_type=False)
vehicle_type_enum_col = postgresql.ENUM('car', 'bike', 'truck', name='vehicletype', create_type=False)
size_category_enum_col = postgresql.ENUM('small', 'medium', 'large', name='sizecategory', create_type=False)
zone_type_enum_col = postgresql.ENUM('general', 'premium', 'service', 'restricted', name='zonetype', create_type=False)
access_level_enum_col = postgresql.ENUM('public', 'employees', 'permit_only', 'vip_only', name='accesslevel', create_type=False)


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    spot_type_enum.create(bind, checkfirst=True)
    vehicle_type_enum.create(bind, checkfirst=True)
    size_category_enum.create(bind, checkfirst=True)
    zone_type_enum.create(bind, checkfirst=True)
    access_level_enum.create(bind, checkfirst=True)

    op.create_table(
        'parking_zones',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('parking_lot_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('zone_type', zone_type_enum_col, nullable=False, server_default='general'),
        sa.Column('access_level', access_level_enum_col, nullable=False, server_default='public'),
        sa.ForeignKeyConstraint(['parking_lot_id'], ['parking_lots.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('parking_lot_id', 'name', name='uq_parking_zones_lot_name'),
    )

    op.add_column('parking_spots', sa.Column('spot_type', spot_type_enum_col, nullable=False, server_default='regular'))
    op.add_column('parking_spots', sa.Column('vehicle_type', vehicle_type_enum_col, nullable=False, server_default='car'))
    op.add_column('parking_spots', sa.Column('zone_id', sa.Integer(), nullable=True))
    op.add_column('parking_spots', sa.Column('has_charger', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('parking_spots', sa.Column('size_category', size_category_enum_col, nullable=False, server_default='medium'))
    op.create_foreign_key('fk_parking_spots_zone_id', 'parking_spots', 'parking_zones', ['zone_id'], ['id'])

    op.execute(
        """
        UPDATE parking_spots
        SET spot_type = CASE
            WHEN type IN ('regular', 'guest', 'disabled', 'ev', 'reserved', 'vip') THEN type::spottype
            ELSE 'regular'::spottype
        END
        """
    )

    op.alter_column('parking_spots', 'spot_type', server_default=None)
    op.alter_column('parking_spots', 'vehicle_type', server_default=None)
    op.alter_column('parking_spots', 'has_charger', server_default=None)
    op.alter_column('parking_spots', 'size_category', server_default=None)
    op.alter_column('parking_zones', 'zone_type', server_default=None)
    op.alter_column('parking_zones', 'access_level', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_parking_spots_zone_id', 'parking_spots', type_='foreignkey')
    op.drop_column('parking_spots', 'size_category')
    op.drop_column('parking_spots', 'has_charger')
    op.drop_column('parking_spots', 'zone_id')
    op.drop_column('parking_spots', 'vehicle_type')
    op.drop_column('parking_spots', 'spot_type')

    op.drop_table('parking_zones')

    bind = op.get_bind()
    access_level_enum.drop(bind, checkfirst=True)
    zone_type_enum.drop(bind, checkfirst=True)
    size_category_enum.drop(bind, checkfirst=True)
    vehicle_type_enum.drop(bind, checkfirst=True)
    spot_type_enum.drop(bind, checkfirst=True)
