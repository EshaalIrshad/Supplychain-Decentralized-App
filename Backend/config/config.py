import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # ── Database ──────────────────────────────────────────────
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'postgresql+psycopg://postgres:SQL12345@localhost:5432/supply_chain_db'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # ── Flask ─────────────────────────────────────────────────
    # IMPORTANT: Set a strong random SECRET_KEY in your .env file.
    # Never commit a real secret key to version control.
    SECRET_KEY = os.getenv('SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY is not set. Add it to your .env file.")

    DEBUG = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

    # ── Blockchain (READ-ONLY — no private key needed) ────────
    BLOCKCHAIN_RPC_URL = os.getenv('BLOCKCHAIN_RPC_URL', 'http://127.0.0.1:8545')
    CONTRACT_ADDRESS   = os.getenv('CONTRACT_ADDRESS')
    if not CONTRACT_ADDRESS:
        raise ValueError("CONTRACT_ADDRESS is not set. Deploy the contract and add its address to .env")

    # ── API ───────────────────────────────────────────────────
    API_PREFIX   = '/api/v1'
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173')  # Vite dev server
