"""add owner_id to parking_lots

Revision ID: 7c1c9a8e4d12
Revises: 9e4f90e6e0a1
Create Date: 2026-03-17 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c1c9a8e4d12'
down_revision: Union[str, Sequence[str], None] = '9e4f90e6e0a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('parking_lots', sa.Column('owner_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_parking_lots_owner_id_users',
        'parking_lots',
        'users',
        ['owner_id'],
        ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_parking_lots_owner_id_users', 'parking_lots', type_='foreignkey')
    op.drop_column('parking_lots', 'owner_id')
