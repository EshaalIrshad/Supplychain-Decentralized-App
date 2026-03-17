import os   #Python module used to access environment variables from the system.
from dotenv import load_dotenv
"""Loads environment variables from .env. 
Raises an error at startup if SECRET_KEY or CONTRACT_ADDRESS are missing 
so you get a clear message instead of a silent crash. 
Contains database URL, blockchain RPC URL, and CORS origins.
"""
load_dotenv()

class Config:
    # Database 
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'postgresql+psycopg://postgres:SQL12345@localhost:5432/supply_chain_db'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Flask 
    SECRET_KEY = os.getenv('SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError("SECRET_KEY is not set. Add it to your .env file.")

    DEBUG = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'

    # Blockchain (READ-ONLY)
    BLOCKCHAIN_RPC_URL = os.getenv('BLOCKCHAIN_RPC_URL', 'http://127.0.0.1:8545')
    CONTRACT_ADDRESS   = os.getenv('CONTRACT_ADDRESS')
    if not CONTRACT_ADDRESS:
        raise ValueError("CONTRACT_ADDRESS is not set. Deploy the contract and add its address to .env")

    # API
    API_PREFIX   = '/api/v1'  #base path added before all all API routes 
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173')  # Vite dev server
