"""add vehicle access events and booking plate

Revision ID: b7c9d12e4f01
Revises: 8f1e2c4a9b11
Create Date: 2026-04-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "b7c9d12e4f01"
down_revision = "8f1e2c4a9b11"
branch_labels = None
depends_on = None


access_direction_enum = postgresql.ENUM("entry", "exit", name="accessdirection", create_type=False)
recognition_source_enum = postgresql.ENUM("manual", "mock", "provider", name="recognitionsource", create_type=False)
access_decision_enum = postgresql.ENUM("allowed", "denied", "review", name="accessdecision", create_type=False)


def upgrade() -> None:
    op.add_column("bookings", sa.Column("plate_number", sa.String(length=64), nullable=True))
    op.create_index(op.f("ix_bookings_plate_number"), "bookings", ["plate_number"], unique=False)

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        access_direction_enum.create(bind, checkfirst=True)
        recognition_source_enum.create(bind, checkfirst=True)
        access_decision_enum.create(bind, checkfirst=True)
        direction_type = access_direction_enum
        source_type = recognition_source_enum
        decision_type = access_decision_enum
    else:
        direction_type = sa.Enum("entry", "exit", name="accessdirection")
        source_type = sa.Enum("manual", "mock", "provider", name="recognitionsource")
        decision_type = sa.Enum("allowed", "denied", "review", name="accessdecision")

    op.create_table(
        "vehicle_access_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("parking_lot_id", sa.Integer(), nullable=False),
        sa.Column("parking_spot_id", sa.Integer(), nullable=True),
        sa.Column("booking_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("plate_number", sa.String(length=64), nullable=False),
        sa.Column("normalized_plate_number", sa.String(length=64), nullable=False),
        sa.Column("direction", direction_type, nullable=False),
        sa.Column("recognition_confidence", sa.Float(), nullable=True),
        sa.Column("recognition_source", source_type, nullable=False),
        sa.Column("decision", decision_type, nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"]),
        sa.ForeignKeyConstraint(["parking_lot_id"], ["parking_lots.id"]),
        sa.ForeignKeyConstraint(["parking_spot_id"], ["parking_spots.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_vehicle_access_events_booking_id"), "vehicle_access_events", ["booking_id"], unique=False)
    op.create_index(op.f("ix_vehicle_access_events_created_at"), "vehicle_access_events", ["created_at"], unique=False)
    op.create_index(op.f("ix_vehicle_access_events_decision"), "vehicle_access_events", ["decision"], unique=False)
    op.create_index(op.f("ix_vehicle_access_events_direction"), "vehicle_access_events", ["direction"], unique=False)
    op.create_index(op.f("ix_vehicle_access_events_normalized_plate_number"), "vehicle_access_events", ["normalized_plate_number"], unique=False)
    op.create_index(op.f("ix_vehicle_access_events_parking_lot_id"), "vehicle_access_events", ["parking_lot_id"], unique=False)
    op.create_index(op.f("ix_vehicle_access_events_parking_spot_id"), "vehicle_access_events", ["parking_spot_id"], unique=False)
    op.create_index(op.f("ix_vehicle_access_events_user_id"), "vehicle_access_events", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_vehicle_access_events_user_id"), table_name="vehicle_access_events")
    op.drop_index(op.f("ix_vehicle_access_events_parking_spot_id"), table_name="vehicle_access_events")
    op.drop_index(op.f("ix_vehicle_access_events_parking_lot_id"), table_name="vehicle_access_events")
    op.drop_index(op.f("ix_vehicle_access_events_normalized_plate_number"), table_name="vehicle_access_events")
    op.drop_index(op.f("ix_vehicle_access_events_direction"), table_name="vehicle_access_events")
    op.drop_index(op.f("ix_vehicle_access_events_decision"), table_name="vehicle_access_events")
    op.drop_index(op.f("ix_vehicle_access_events_created_at"), table_name="vehicle_access_events")
    op.drop_index(op.f("ix_vehicle_access_events_booking_id"), table_name="vehicle_access_events")
    op.drop_table("vehicle_access_events")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        access_decision_enum.drop(bind, checkfirst=True)
        recognition_source_enum.drop(bind, checkfirst=True)
        access_direction_enum.drop(bind, checkfirst=True)

    op.drop_index(op.f("ix_bookings_plate_number"), table_name="bookings")
    op.drop_column("bookings", "plate_number")
