"""add vehicles and access event media

Revision ID: c91f4a2e8d33
Revises: b7c9d12e4f01
Create Date: 2026-04-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "c91f4a2e8d33"
down_revision = "b7c9d12e4f01"
branch_labels = None
depends_on = None


vehicle_type_enum = postgresql.ENUM("car", "ev", "truck", "bike", "van", name="vehicletype", create_type=False)
processing_status_enum = postgresql.ENUM("pending", "processed", "failed", name="processingstatus", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        vehicle_type_enum.create(bind, checkfirst=True)
        processing_status_enum.create(bind, checkfirst=True)
        vehicle_type = vehicle_type_enum
        processing_status = processing_status_enum
    else:
        vehicle_type = sa.Enum("car", "ev", "truck", "bike", "van", name="vehicletype")
        processing_status = sa.Enum("pending", "processed", "failed", name="processingstatus")

    op.create_table(
        "vehicles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("plate_number", sa.String(length=64), nullable=False),
        sa.Column("normalized_plate_number", sa.String(length=64), nullable=False),
        sa.Column("vehicle_type", vehicle_type, nullable=False),
        sa.Column("brand", sa.String(length=64), nullable=True),
        sa.Column("model", sa.String(length=64), nullable=True),
        sa.Column("color", sa.String(length=32), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("normalized_plate_number", name="uq_vehicles_normalized_plate_number"),
    )
    op.create_index(op.f("ix_vehicles_user_id"), "vehicles", ["user_id"], unique=False)
    op.create_index(op.f("ix_vehicles_normalized_plate_number"), "vehicles", ["normalized_plate_number"], unique=False)

    op.add_column("bookings", sa.Column("vehicle_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_bookings_vehicle_id", "bookings", "vehicles", ["vehicle_id"], ["id"])
    op.create_index(op.f("ix_bookings_vehicle_id"), "bookings", ["vehicle_id"], unique=False)

    op.add_column("vehicle_access_events", sa.Column("vehicle_id", sa.Integer(), nullable=True))
    op.add_column("vehicle_access_events", sa.Column("image_url", sa.String(length=255), nullable=True))
    op.add_column("vehicle_access_events", sa.Column("video_url", sa.String(length=255), nullable=True))
    op.add_column("vehicle_access_events", sa.Column("frame_timestamp", sa.Numeric(10, 3), nullable=True))
    op.add_column("vehicle_access_events", sa.Column("processing_status", processing_status, nullable=False, server_default="processed"))
    op.create_foreign_key("fk_vehicle_access_events_vehicle_id", "vehicle_access_events", "vehicles", ["vehicle_id"], ["id"])
    op.create_index(op.f("ix_vehicle_access_events_vehicle_id"), "vehicle_access_events", ["vehicle_id"], unique=False)
    op.alter_column("vehicle_access_events", "processing_status", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_vehicle_access_events_vehicle_id"), table_name="vehicle_access_events")
    op.drop_constraint("fk_vehicle_access_events_vehicle_id", "vehicle_access_events", type_="foreignkey")
    op.drop_column("vehicle_access_events", "processing_status")
    op.drop_column("vehicle_access_events", "frame_timestamp")
    op.drop_column("vehicle_access_events", "video_url")
    op.drop_column("vehicle_access_events", "image_url")
    op.drop_column("vehicle_access_events", "vehicle_id")

    op.drop_index(op.f("ix_bookings_vehicle_id"), table_name="bookings")
    op.drop_constraint("fk_bookings_vehicle_id", "bookings", type_="foreignkey")
    op.drop_column("bookings", "vehicle_id")

    op.drop_index(op.f("ix_vehicles_normalized_plate_number"), table_name="vehicles")
    op.drop_index(op.f("ix_vehicles_user_id"), table_name="vehicles")
    op.drop_table("vehicles")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        processing_status_enum.drop(bind, checkfirst=True)
        vehicle_type_enum.drop(bind, checkfirst=True)
