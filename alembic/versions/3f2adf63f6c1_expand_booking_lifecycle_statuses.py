"""expand booking lifecycle statuses

Revision ID: 3f2adf63f6c1
Revises: c2d4a8f7b901
Create Date: 2026-04-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f2adf63f6c1'
down_revision: Union[str, Sequence[str], None] = 'c2d4a8f7b901'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


OLD_VALUES = ('active', 'cancelled', 'completed', 'expired')
NEW_VALUES = ('pending', 'confirmed', 'active', 'completed', 'cancelled', 'expired', 'no_show')


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        op.execute("ALTER TYPE bookingstatus RENAME TO bookingstatus_old")
        sa.Enum(*NEW_VALUES, name='bookingstatus').create(bind, checkfirst=False)
        op.execute(
            """
            ALTER TABLE bookings
            ALTER COLUMN status TYPE bookingstatus
            USING CASE
                WHEN status::text = 'active' THEN 'active'::bookingstatus
                WHEN status::text = 'cancelled' THEN 'cancelled'::bookingstatus
                WHEN status::text = 'completed' THEN 'completed'::bookingstatus
                WHEN status::text = 'expired' THEN 'expired'::bookingstatus
                ELSE 'pending'::bookingstatus
            END
            """
        )
        op.execute("DROP TYPE bookingstatus_old")
    else:
        with op.batch_alter_table('bookings') as batch_op:
            batch_op.alter_column(
                'status',
                type_=sa.Enum(*NEW_VALUES, name='bookingstatus'),
                existing_type=sa.Enum(*OLD_VALUES, name='bookingstatus'),
                existing_nullable=False,
            )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == 'postgresql':
        op.execute("ALTER TYPE bookingstatus RENAME TO bookingstatus_new")
        sa.Enum(*OLD_VALUES, name='bookingstatus').create(bind, checkfirst=False)
        op.execute(
            """
            ALTER TABLE bookings
            ALTER COLUMN status TYPE bookingstatus
            USING CASE
                WHEN status::text = 'pending' THEN 'active'::bookingstatus
                WHEN status::text = 'confirmed' THEN 'active'::bookingstatus
                WHEN status::text = 'active' THEN 'active'::bookingstatus
                WHEN status::text = 'completed' THEN 'completed'::bookingstatus
                WHEN status::text = 'cancelled' THEN 'cancelled'::bookingstatus
                WHEN status::text = 'expired' THEN 'expired'::bookingstatus
                WHEN status::text = 'no_show' THEN 'expired'::bookingstatus
                ELSE 'active'::bookingstatus
            END
            """
        )
        op.execute("DROP TYPE bookingstatus_new")
    else:
        with op.batch_alter_table('bookings') as batch_op:
            batch_op.alter_column(
                'status',
                type_=sa.Enum(*OLD_VALUES, name='bookingstatus'),
                existing_type=sa.Enum(*NEW_VALUES, name='bookingstatus'),
                existing_nullable=False,
            )
