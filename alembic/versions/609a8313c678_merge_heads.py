"""merge heads

Revision ID: 609a8313c678
Revises: 3f2adf63f6c1, ae1024a9d41b
Create Date: 2026-04-10 14:16:48.483544

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '609a8313c678'
down_revision: Union[str, Sequence[str], None] = ('3f2adf63f6c1', 'ae1024a9d41b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
