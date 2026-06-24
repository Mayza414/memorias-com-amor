"""adiciona bio e profile_pic

Revision ID: 20240624_0001
Revises: 
Create Date: 2026-06-24 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '20240624_0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('users', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('profile_pic', sa.String(500), nullable=True))

def downgrade() -> None:
    op.drop_column('users', 'bio')
    op.drop_column('users', 'profile_pic')
