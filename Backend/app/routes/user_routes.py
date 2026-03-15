from flask import Blueprint, request, jsonify
from app import db
from app.models import User
from app.services.blockchain_service import blockchain_service

# ------------------------------------------------------------
# User routes — off-chain profile management only
#
# Roles are assigned ON-CHAIN by the user's own MetaMask wallet
# calling assignRole() directly on the smart contract.
# The backend never assigns roles — it only reads them.
# ------------------------------------------------------------

user_bp = Blueprint('users', __name__)


# ── Helpers ──────────────────────────────────────────────────

def _normalise_address(addr):
    """Lowercase the address for consistent DB storage."""
    return addr.strip().lower()

def _validate_wallet(addr):
    """Basic sanity check — Ethereum addresses are 42 chars starting with 0x."""
    return isinstance(addr, str) and len(addr) == 42 and addr.startswith('0x')


# ── POST /api/v1/users ────────────────────────────────────────
# Create an off-chain profile for a wallet address.
# The wallet must already have a role on-chain before calling this,
# because we verify the role exists on the blockchain.
@user_bp.route('/users', methods=['POST'])
def create_user():
    """
    Create an off-chain user profile.

    Request body:
    {
        "wallet_address": "0xABC...",   -- required
        "name":           "John Doe",   -- optional
        "company_name":   "Acme Corp"   -- optional
    }

    The role is NOT set here — it must already be assigned on-chain
    via assignRole() called from the user's MetaMask wallet.
    """
    data = request.get_json(silent=True) or {}

    wallet = data.get('wallet_address', '').strip()
    if not _validate_wallet(wallet):
        return jsonify({'error': 'wallet_address is required and must be a valid 42-char Ethereum address'}), 400

    wallet = _normalise_address(wallet)

    # Check the wallet actually has a role on-chain (sanity guard)
    on_chain_role = blockchain_service.get_user_role(wallet)
    if isinstance(on_chain_role, dict) and 'error' in on_chain_role:
        return jsonify({'error': 'Could not verify role on blockchain', 'details': on_chain_role['error']}), 502
    if on_chain_role == 'None':
        return jsonify({
            'error': 'This wallet has no role assigned on-chain yet. '
                     'Please call assignRole() from your MetaMask wallet first.'
        }), 400

    # Upsert: if profile already exists, return it
    existing = User.query.filter_by(wallet_address=wallet).first()
    if existing:
        return jsonify({
            'message':       'Profile already exists',
            'user':          existing.to_dict(),
            'on_chain_role': on_chain_role,
        }), 200

    user = User(
        wallet_address=wallet,
        name=data.get('name'),
        company_name=data.get('company_name'),
    )
    db.session.add(user)
    db.session.commit()

    return jsonify({
        'message':       'User profile created',
        'user':          user.to_dict(),
        'on_chain_role': on_chain_role,
    }), 201


# ── GET /api/v1/users/<wallet_address> ───────────────────────
@user_bp.route('/users/<wallet_address>', methods=['GET'])
def get_user(wallet_address):
    """
    Get off-chain profile + live on-chain role for a wallet.
    """
    wallet = _normalise_address(wallet_address)
    user   = User.query.filter_by(wallet_address=wallet).first()

    if not user:
        return jsonify({'error': 'User profile not found'}), 404

    on_chain_role = blockchain_service.get_user_role(wallet)

    data               = user.to_dict()
    data['on_chain_role'] = on_chain_role
    return jsonify(data), 200


# ── GET /api/v1/users ─────────────────────────────────────────
@user_bp.route('/users', methods=['GET'])
def list_users():
    """
    List all user profiles with pagination.
    Query params: page, per_page
    """
    page     = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)

    pagination = User.query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'users':    [u.to_dict() for u in pagination.items],
        'total':    pagination.total,
        'page':     pagination.page,
        'per_page': pagination.per_page,
        'pages':    pagination.pages,
    }), 200


# ── PUT /api/v1/users/<wallet_address> ───────────────────────
@user_bp.route('/users/<wallet_address>', methods=['PUT'])
def update_user(wallet_address):
    """
    Update off-chain profile fields (name, company_name).
    Roles are on-chain and cannot be changed here.
    """
    wallet = _normalise_address(wallet_address)
    user   = User.query.filter_by(wallet_address=wallet).first()

    if not user:
        return jsonify({'error': 'User profile not found'}), 404

    data = request.get_json(silent=True) or {}

    if 'name' in data:
        user.name = data['name']
    if 'company_name' in data:
        user.company_name = data['company_name']

    db.session.commit()
    return jsonify({'message': 'Profile updated', 'user': user.to_dict()}), 200


# ── DELETE /api/v1/users/<wallet_address> ────────────────────
@user_bp.route('/users/<wallet_address>', methods=['DELETE'])
def delete_user(wallet_address):
    """
    Delete the off-chain profile.
    This does NOT affect the role stored on the blockchain.
    """
    wallet = _normalise_address(wallet_address)
    user   = User.query.filter_by(wallet_address=wallet).first()

    if not user:
        return jsonify({'error': 'User profile not found'}), 404

    db.session.delete(user)
    db.session.commit()
    return jsonify({'message': 'Profile deleted (on-chain role unchanged)'}), 200


# ── GET /api/v1/users/<wallet_address>/role ──────────────────
@user_bp.route('/users/<wallet_address>/role', methods=['GET'])
def get_role(wallet_address):
    """
    Read the wallet's role directly from the blockchain.
    This is the single source of truth for roles.
    """
    wallet        = _normalise_address(wallet_address)
    on_chain_role = blockchain_service.get_user_role(wallet)

    if isinstance(on_chain_role, dict) and 'error' in on_chain_role:
        return jsonify({'error': 'Blockchain query failed', 'details': on_chain_role['error']}), 502

    return jsonify({
        'wallet_address': wallet,
        'role':           on_chain_role,
    }), 200
