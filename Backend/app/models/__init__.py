from datetime import datetime
from app import db

# ------------------------------------------------------------
# What goes in the DATABASE vs the BLOCKCHAIN
#
# BLOCKCHAIN stores (do NOT duplicate here):
#   - product owner address
#   - product stage / history
#   - wallet roles (Manufacturer, Distributor, etc.)
#   - all timestamps for stage updates
#
# DATABASE stores (off-chain enrichment only):
#   - human-readable user profile  (name, company)
#   - product metadata             (description, category, image)
#   - uploaded documents           (URLs + file hashes)
#   - transaction log              (tx hashes for quick lookup)
# ------------------------------------------------------------


class User(db.Model):
    """
    Off-chain user profile.
    The wallet_address is the primary identity — it links this
    profile to the on-chain role stored in the smart contract.
    We do NOT store 'role' here; always read it from the blockchain.
    """
    __tablename__ = 'users'

    id             = db.Column(db.Integer, primary_key=True)
    wallet_address = db.Column(db.String(42), unique=True, nullable=False, index=True)
    name           = db.Column(db.String(100))
    company_name   = db.Column(db.String(100))
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at     = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # One user can own the off-chain metadata for many products
    products  = db.relationship('ProductMetadata', backref='creator', lazy='dynamic')

    def to_dict(self):
        return {
            'id':             self.id,
            'wallet_address': self.wallet_address,
            'name':           self.name,
            'company_name':   self.company_name,
            'created_at':     self.created_at.isoformat() if self.created_at else None,
            'updated_at':     self.updated_at.isoformat() if self.updated_at else None,
        }


class ProductMetadata(db.Model):
    """
    Off-chain enrichment for a product.
    Linked to the on-chain product by product_id (the same uint
    used in RegisterProduct on the smart contract).

    Fields like current_owner and current_stage are NOT stored here —
    those are always fetched live from the blockchain.
    """
    __tablename__ = 'products'

    id                  = db.Column(db.Integer, primary_key=True)
    # Must match the uint id used in the smart contract
    product_id          = db.Column(db.BigInteger, unique=True, nullable=False, index=True)
    name                = db.Column(db.String(200), nullable=False)
    description         = db.Column(db.Text)
    category            = db.Column(db.String(50))
    # FK to the user who registered this product (for off-chain lookups)
    manufacturer_wallet = db.Column(db.String(42), nullable=False)
    manufacturer_id     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Media / certificate links (not stored on-chain — too expensive)
    image_url           = db.Column(db.String(500))
    certificate_url     = db.Column(db.String(500))

    created_at          = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at          = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    documents = db.relationship('Document', backref='product', lazy='dynamic',
                                cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id':                  self.id,
            'product_id':          self.product_id,
            'name':                self.name,
            'description':         self.description,
            'category':            self.category,
            'manufacturer_wallet': self.manufacturer_wallet,
            'image_url':           self.image_url,
            'certificate_url':     self.certificate_url,
            'created_at':          self.created_at.isoformat() if self.created_at else None,
            'updated_at':          self.updated_at.isoformat() if self.updated_at else None,
        }


class Document(db.Model):
    """Off-chain documents attached to a product (PDFs, certs, etc.)."""
    __tablename__ = 'documents'

    id                  = db.Column(db.Integer, primary_key=True)
    product_id          = db.Column(db.Integer, db.ForeignKey('products.id'), nullable=False)
    document_type       = db.Column(db.String(50), nullable=False)   # e.g. 'certificate', 'invoice'
    document_name       = db.Column(db.String(200), nullable=False)
    document_url        = db.Column(db.String(500), nullable=False)
    # SHA-256 of the file — lets anyone verify the file hasn't changed
    file_hash           = db.Column(db.String(66))
    uploaded_by_wallet  = db.Column(db.String(42), nullable=False)
    uploaded_by         = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at          = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':                 self.id,
            'document_type':      self.document_type,
            'document_name':      self.document_name,
            'document_url':       self.document_url,
            'file_hash':          self.file_hash,
            'uploaded_by_wallet': self.uploaded_by_wallet,
            'created_at':         self.created_at.isoformat() if self.created_at else None,
        }


class TransactionLog(db.Model):
    """
    Log of blockchain transactions initiated through this app.
    Useful for quick lookups without re-querying the chain.
    We record the tx hash only AFTER the frontend confirms it was
    submitted — we never sign anything server-side.
    """
    __tablename__ = 'transaction_logs'

    id               = db.Column(db.Integer, primary_key=True)
    transaction_hash = db.Column(db.String(66), unique=True, nullable=False, index=True)
    from_address     = db.Column(db.String(42), nullable=False)   # msg.sender (user's wallet)
    function_name    = db.Column(db.String(50), nullable=False)   # e.g. 'RegisterProduct'
    product_id       = db.Column(db.BigInteger, nullable=True)
    block_number     = db.Column(db.BigInteger, nullable=True)
    gas_used         = db.Column(db.BigInteger, nullable=True)
    created_at       = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':               self.id,
            'transaction_hash': self.transaction_hash,
            'from_address':     self.from_address,
            'function_name':    self.function_name,
            'product_id':       self.product_id,
            'block_number':     self.block_number,
            'gas_used':         self.gas_used,
            'created_at':       self.created_at.isoformat() if self.created_at else None,
        }
