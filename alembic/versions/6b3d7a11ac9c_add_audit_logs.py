"""add audit logs

Revision ID: 6b3d7a11ac9c
Revises: ae1024a9d41b
Create Date: 2026-04-13
"""

from alembic import op
import sqlalchemy as sa


revision = "6b3d7a11ac9c"
down_revision = "ae1024a9d41b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("action_type", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=True),
        sa.Column("old_values", sa.JSON(), nullable=True),
        sa.Column("new_values", sa.JSON(), nullable=True),
        sa.Column("source_metadata", sa.JSON(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_action_type"), "audit_logs", ["action_type"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_id"), "audit_logs", ["entity_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_type"), "audit_logs", ["entity_type"], unique=False)
    op.create_index(op.f("ix_audit_logs_timestamp"), "audit_logs", ["timestamp"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_logs_timestamp"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_entity_type"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_entity_id"), table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_action_type"), table_name="audit_logs")
    op.drop_table("audit_logs")
