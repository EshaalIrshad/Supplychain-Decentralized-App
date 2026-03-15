"""Redesigned tables — off-chain metadata only, no blockchain-duplicate fields

Revision ID: a1b2c3d4e5f6
Revises:
Create Date: 2026-03-16 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision     = 'a1b2c3d4e5f6'
down_revision = None
branch_labels = None
depends_on    = None


def upgrade():
    # users — off-chain profile, NO 'role' column (role lives on-chain)
    op.create_table(
        'users',
        sa.Column('id',             sa.Integer(),     primary_key=True),
        sa.Column('wallet_address', sa.String(42),    nullable=False),
        sa.Column('name',           sa.String(100),   nullable=True),
        sa.Column('company_name',   sa.String(100),   nullable=True),
        sa.Column('created_at',     sa.DateTime(),    nullable=True),
        sa.Column('updated_at',     sa.DateTime(),    nullable=True),
    )
    op.create_index('ix_users_wallet_address', 'users', ['wallet_address'], unique=True)

    # products — off-chain metadata only
    # NO current_owner / current_stage — those come from the blockchain
    op.create_table(
        'products',
        sa.Column('id',                  sa.Integer(),    primary_key=True),
        sa.Column('product_id',          sa.BigInteger(), nullable=False),   # matches on-chain uint id
        sa.Column('name',                sa.String(200),  nullable=False),
        sa.Column('description',         sa.Text(),       nullable=True),
        sa.Column('category',            sa.String(50),   nullable=True),
        sa.Column('manufacturer_wallet', sa.String(42),   nullable=False),
        sa.Column('manufacturer_id',     sa.Integer(),    sa.ForeignKey('users.id'), nullable=True),
        sa.Column('image_url',           sa.String(500),  nullable=True),
        sa.Column('certificate_url',     sa.String(500),  nullable=True),
        sa.Column('created_at',          sa.DateTime(),   nullable=True),
        sa.Column('updated_at',          sa.DateTime(),   nullable=True),
    )
    op.create_index('ix_products_product_id', 'products', ['product_id'], unique=True)

    # documents — files attached to a product
    op.create_table(
        'documents',
        sa.Column('id',                  sa.Integer(),   primary_key=True),
        sa.Column('product_id',          sa.Integer(),   sa.ForeignKey('products.id'), nullable=False),
        sa.Column('document_type',       sa.String(50),  nullable=False),
        sa.Column('document_name',       sa.String(200), nullable=False),
        sa.Column('document_url',        sa.String(500), nullable=False),
        sa.Column('file_hash',           sa.String(66),  nullable=True),
        sa.Column('uploaded_by_wallet',  sa.String(42),  nullable=False),
        sa.Column('uploaded_by',         sa.Integer(),   sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at',          sa.DateTime(),  nullable=True),
    )

    # transaction_logs — record of tx hashes submitted by the frontend
    # We never sign here; we only log hashes after the user's MetaMask submits them
    op.create_table(
        'transaction_logs',
        sa.Column('id',               sa.Integer(),    primary_key=True),
        sa.Column('transaction_hash', sa.String(66),   nullable=False),
        sa.Column('from_address',     sa.String(42),   nullable=False),
        sa.Column('function_name',    sa.String(50),   nullable=False),
        sa.Column('product_id',       sa.BigInteger(), nullable=True),
        sa.Column('block_number',     sa.BigInteger(), nullable=True),
        sa.Column('gas_used',         sa.BigInteger(), nullable=True),
        sa.Column('created_at',       sa.DateTime(),   nullable=True),
    )
    op.create_index('ix_transaction_logs_tx_hash', 'transaction_logs', ['transaction_hash'], unique=True)


def downgrade():
    op.drop_table('transaction_logs')
    op.drop_table('documents')
    op.drop_index('ix_products_product_id', table_name='products')
    op.drop_table('products')
    op.drop_index('ix_users_wallet_address', table_name='users')
    op.drop_table('users')
