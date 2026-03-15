from flask import Blueprint, request, jsonify
from app import db
from app.models import ProductMetadata, TransactionLog, User
from app.services.blockchain_service import blockchain_service

# ------------------------------------------------------------
# Product routes
#
# KEY DESIGN PRINCIPLE:
#   Write transactions happen IN THE BROWSER (MetaMask signs them).
#   The frontend submits the transaction to the blockchain directly,
#   then sends us the resulting tx_hash so we can:
#     (a) confirm it landed on-chain
#     (b) save any off-chain metadata (description, image, etc.)
#     (c) log the tx hash for quick lookup
#
#   We NEVER sign transactions here.
#   We NEVER store stage / owner data — those come from the chain.
# ------------------------------------------------------------

product_bp = Blueprint('products', __name__)


# ── Helpers ──────────────────────────────────────────────────

def _normalise_address(addr):
    return addr.strip().lower() if addr else None

def _validate_tx_hash(h):
    return isinstance(h, str) and len(h) == 66 and h.startswith('0x')


# ── POST /api/v1/products ─────────────────────────────────────
# Called AFTER the user's MetaMask has already called RegisterProduct()
# on the smart contract. We just save the off-chain metadata and log
# the tx hash.
@product_bp.route('/products', methods=['POST'])
def register_product_metadata():
    """
    Save off-chain metadata for a product that was just registered
    on the blockchain by the user's MetaMask.

    Request body:
    {
        "product_id":          1001,          -- required, must match on-chain id
        "name":                "Widget A",    -- required
        "tx_hash":             "0xABC...",    -- required, the MetaMask tx hash
        "manufacturer_wallet": "0xDEF...",    -- required
        "description":         "...",         -- optional
        "category":            "Electronics", -- optional
        "image_url":           "https://...", -- optional
        "certificate_url":     "https://..."  -- optional
    }
    """
    data = request.get_json(silent=True) or {}

    # Validate required fields
    for field in ['product_id', 'name', 'tx_hash', 'manufacturer_wallet']:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400

    tx_hash = data['tx_hash']
    if not _validate_tx_hash(tx_hash):
        return jsonify({'error': 'tx_hash must be a valid 66-char hex string starting with 0x'}), 400

    # Confirm the transaction actually landed on-chain
    receipt = blockchain_service.get_transaction_receipt(tx_hash)
    if receipt is None:
        return jsonify({'error': 'Transaction not found on blockchain. Wait for it to be mined and try again.'}), 404
    if receipt['status'] != 1:
        return jsonify({'error': 'Transaction was reverted on-chain. Product was not registered.'}), 400

    product_id = data['product_id']

    # Check the product actually exists on-chain now
    on_chain = blockchain_service.get_product(product_id)
    if on_chain is None:
        return jsonify({'error': f'Product {product_id} not found on blockchain after tx confirmed.'}), 404

    # Guard against duplicate metadata records
    existing = ProductMetadata.query.filter_by(product_id=product_id).first()
    if existing:
        return jsonify({'error': f'Metadata for product {product_id} already exists', 'product': existing.to_dict()}), 400

    manufacturer_wallet = _normalise_address(data['manufacturer_wallet'])

    # Try to link to a DB user profile (optional — product can exist without one)
    user = User.query.filter_by(wallet_address=manufacturer_wallet).first()

    metadata = ProductMetadata(
        product_id          = product_id,
        name                = data['name'],
        description         = data.get('description'),
        category            = data.get('category'),
        manufacturer_wallet = manufacturer_wallet,
        manufacturer_id     = user.id if user else None,
        image_url           = data.get('image_url'),
        certificate_url     = data.get('certificate_url'),
    )
    db.session.add(metadata)
    db.session.flush()   # get metadata.id before committing

    # Log the transaction
    tx_log = TransactionLog(
        transaction_hash = tx_hash,
        from_address     = receipt['from_address'],
        function_name    = 'RegisterProduct',
        product_id       = product_id,
        block_number     = receipt['block_number'],
        gas_used         = receipt['gas_used'],
    )
    db.session.add(tx_log)
    db.session.commit()

    return jsonify({
        'message':        'Product metadata saved',
        'product':        metadata.to_dict(),
        'blockchain_data': on_chain,
        'tx_hash':        tx_hash,
    }), 201


# ── GET /api/v1/products/<product_id> ────────────────────────
@product_bp.route('/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """
    Get combined product info: off-chain metadata from DB
    + live owner/name from blockchain.
    """
    # Live blockchain data (source of truth for owner / existence)
    on_chain = blockchain_service.get_product(product_id)
    if on_chain is None:
        return jsonify({'error': f'Product {product_id} not found on blockchain'}), 404

    # Current stage — read directly from chain (avoids fetching full history)
    current_stage = blockchain_service.get_current_stage(product_id)
    if not isinstance(current_stage, dict):
        on_chain['current_stage'] = current_stage

    # Off-chain metadata (may not exist if registered directly on-chain)
    metadata = ProductMetadata.query.filter_by(product_id=product_id).first()

    return jsonify({
        'product_id':      product_id,
        'blockchain_data': on_chain,           # owner, name, current_stage (from chain)
        'metadata':        metadata.to_dict() if metadata else None,
    }), 200


# ── GET /api/v1/products ─────────────────────────────────────
@product_bp.route('/products', methods=['GET'])
def list_products():
    """
    List all products that have off-chain metadata records.
    Pagination via ?page=1&per_page=20
    Optional filter: ?category=Electronics
    """
    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)
    category = request.args.get('category')

    query = ProductMetadata.query
    if category:
        query = query.filter_by(category=category)

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'products': [p.to_dict() for p in pagination.items],
        'total':    pagination.total,
        'page':     pagination.page,
        'per_page': pagination.per_page,
        'pages':    pagination.pages,
    }), 200


# ── GET /api/v1/products/<product_id>/history ────────────────
@product_bp.route('/products/<int:product_id>/history', methods=['GET'])
def get_product_history(product_id):
    """
    Get the full stage history from the blockchain.
    This is the immutable audit trail — read directly from the chain.
    """
    # Verify product exists first
    on_chain = blockchain_service.get_product(product_id)
    if on_chain is None:
        return jsonify({'error': f'Product {product_id} not found on blockchain'}), 404

    history = blockchain_service.get_product_history(product_id)
    if isinstance(history, dict) and 'error' in history:
        return jsonify({'error': 'Failed to fetch history from blockchain', 'details': history['error']}), 502

    return jsonify({
        'product_id': product_id,
        'owner':      on_chain['owner'],
        'history':    history,   # [{stage, timestamp, updater_address}, ...]
    }), 200


# ── POST /api/v1/products/<product_id>/stage ─────────────────
# Called AFTER the user's MetaMask has already called updateStage()
# on the smart contract. We just log the tx hash.
@product_bp.route('/products/<int:product_id>/stage', methods=['POST'])
def log_stage_update(product_id):
    """
    Log a stage-update transaction that was already submitted on-chain.

    Request body:
    {
        "tx_hash": "0xABC..."   -- required
    }
    """
    data    = request.get_json(silent=True) or {}
    tx_hash = data.get('tx_hash', '')

    if not _validate_tx_hash(tx_hash):
        return jsonify({'error': 'tx_hash is required and must be a valid 66-char hex string'}), 400

    receipt = blockchain_service.get_transaction_receipt(tx_hash)
    if receipt is None:
        return jsonify({'error': 'Transaction not found on blockchain'}), 404
    if receipt['status'] != 1:
        return jsonify({'error': 'Transaction was reverted on-chain'}), 400

    # Check for duplicate log
    if TransactionLog.query.filter_by(transaction_hash=tx_hash).first():
        return jsonify({'message': 'Transaction already logged'}), 200

    tx_log = TransactionLog(
        transaction_hash = tx_hash,
        from_address     = receipt['from_address'],
        function_name    = 'updateStage',
        product_id       = product_id,
        block_number     = receipt['block_number'],
        gas_used         = receipt['gas_used'],
    )
    db.session.add(tx_log)
    db.session.commit()

    # Return the current on-chain state so the frontend can update its UI
    on_chain = blockchain_service.get_product(product_id)
    history  = blockchain_service.get_product_history(product_id)

    return jsonify({
        'message':  'Stage update logged',
        'tx_hash':  tx_hash,
        'product':  on_chain,
        'history':  history,
    }), 200


# ── POST /api/v1/products/<product_id>/transfer ──────────────
# Called AFTER the user's MetaMask has already called transferOwnership()
@product_bp.route('/products/<int:product_id>/transfer', methods=['POST'])
def log_ownership_transfer(product_id):
    """
    Log an ownership-transfer transaction that was already submitted on-chain.

    Request body:
    {
        "tx_hash": "0xABC..."   -- required
    }
    """
    data    = request.get_json(silent=True) or {}
    tx_hash = data.get('tx_hash', '')

    if not _validate_tx_hash(tx_hash):
        return jsonify({'error': 'tx_hash is required and must be a valid 66-char hex string'}), 400

    receipt = blockchain_service.get_transaction_receipt(tx_hash)
    if receipt is None:
        return jsonify({'error': 'Transaction not found on blockchain'}), 404
    if receipt['status'] != 1:
        return jsonify({'error': 'Transaction was reverted on-chain'}), 400

    if TransactionLog.query.filter_by(transaction_hash=tx_hash).first():
        return jsonify({'message': 'Transaction already logged'}), 200

    tx_log = TransactionLog(
        transaction_hash = tx_hash,
        from_address     = receipt['from_address'],
        function_name    = 'transferOwnership',
        product_id       = product_id,
        block_number     = receipt['block_number'],
        gas_used         = receipt['gas_used'],
    )
    db.session.add(tx_log)
    db.session.commit()

    on_chain = blockchain_service.get_product(product_id)

    return jsonify({
        'message': 'Ownership transfer logged',
        'tx_hash': tx_hash,
        'product': on_chain,
    }), 200


# ── GET /api/v1/products/<product_id>/verify ─────────────────
@product_bp.route('/products/<int:product_id>/verify', methods=['GET'])
def verify_product(product_id):
    """
    Verify whether a wallet address is the current owner of a product.

    Query param: ?wallet=0xABC...
    """
    wallet = request.args.get('wallet', '').strip()
    if not wallet:
        return jsonify({'error': 'wallet query parameter is required'}), 400

    result = blockchain_service.verify_product_owner(product_id, wallet)

    if isinstance(result, dict) and 'error' in result:
        return jsonify({'error': 'Blockchain query failed', 'details': result['error']}), 502

    on_chain = blockchain_service.get_product(product_id)

    return jsonify({
        'product_id':     product_id,
        'queried_wallet': wallet,
        'is_owner':       result,
        'current_owner':  on_chain['owner'] if on_chain else None,
    }), 200
