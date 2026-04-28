"""add recognition provider to vehicle access events

Revision ID: e3b7c1d2f9a4
Revises: c91f4a2e8d33
Create Date: 2026-04-28 12:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "e3b7c1d2f9a4"
down_revision = "c91f4a2e8d33"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("vehicle_access_events", sa.Column("recognition_provider", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("vehicle_access_events", "recognition_provider")
