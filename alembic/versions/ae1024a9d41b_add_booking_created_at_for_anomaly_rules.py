"""add booking created_at for anomaly rules

Revision ID: ae1024a9d41b
Revises: a4d8f3b21c6e
Create Date: 2026-04-10
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "ae1024a9d41b"
down_revision = "a4d8f3b21c6e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "bookings",
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.execute("UPDATE bookings SET created_at = start_time")
    op.alter_column("bookings", "created_at", nullable=False)


def downgrade() -> None:
    op.drop_column("bookings", "created_at")
