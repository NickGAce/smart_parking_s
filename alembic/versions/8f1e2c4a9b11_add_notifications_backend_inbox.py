"""add notifications backend inbox

Revision ID: 8f1e2c4a9b11
Revises: 609a8313c678
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa


revision = "8f1e2c4a9b11"
down_revision = "609a8313c678"
branch_labels = None
depends_on = None


notification_type_enum = sa.Enum(
    "booking_created",
    "booking_confirmed",
    "booking_cancelled",
    "booking_starts_soon",
    "booking_expired",
    "booking_no_show",
    "parking_rules_violation",
    name="notificationtype",
)

notification_status_enum = sa.Enum("unread", "read", name="notificationstatus")


def upgrade() -> None:
    notification_type_enum.create(op.get_bind(), checkfirst=True)
    notification_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("booking_id", sa.Integer(), nullable=True),
        sa.Column("type", notification_type_enum, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", notification_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        sa.Column("read_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)
    op.create_index(op.f("ix_notifications_booking_id"), "notifications", ["booking_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notifications_booking_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_table("notifications")

    notification_status_enum.drop(op.get_bind(), checkfirst=True)
    notification_type_enum.drop(op.get_bind(), checkfirst=True)
