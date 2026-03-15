## Supplychain-blockchain-Dapp

A decentralized supply chain application (DApp) built with Next.js, Solidity, Hardhat, and PostgreSQL, enabling stakeholders to verify product authenticity, track ownership, and ensure transparency. Critical product data is stored on-chain for immutability, while large or optional data is stored off-chain.

## Supply Chain Smart Contract (Hardhat)

Ethereum smart contract for supply chain tracking with role-based access control.

#### Install dependencies

npm install

#### Smart Contract

The `SupplyChain.sol` contract provides:

- Role-based access (Manufacturer, Distributor, Retailer, Consumer)
- Product registration and tracking
- Stage updates (Registered → Manufactured → Shipped → Delivered → Sold)
- Ownership transfers
- Product verification
- Complete audit trail

#### Compile Contract

npx hardhat compile
or
npm run compile

#### Start Local Node

npx hardhat node
or
npm run node

This starts a local Ethereum node on `http://127.0.0.1:8545` with 20 test accounts.

**Important:** Keep this terminal running while developing!

#### Deploy Contract

In a new terminal:
npx hardhat run scripts/deploy.js --network localhost  
or
npm run deploy

Copy the deployed contract address and update in your backend's `.env` file.

#### Contract Functions

#### Write Functions (Require Gas)

- `assignRole(address, role)` - Assign role to user
- `RegisterProduct(id, name)` - Register new product (Manufacturer only)
- `updateStage(id, stage)` - Update product stage
- `transferOwnership(id, newOwner)` - Transfer product ownership

#### Read Functions (Free)

- `products(id)` - Get product details
- `getProductHistory(id)` - Get complete history
- `verifyProduct(id, owner)` - Verify product authenticity
- `getRole(address)` - Get user's role

## Supply Chain Backend (Flask API)

Flask REST API backend for blockchain-based supply chain tracking system.

#### Features

- RESTful API for supply chain operations
- PostgreSQL database for off-chain data
- Web3 integration with Ethereum smart contract
- User management with role-based access
- Product registration and tracking
- Complete audit trail with blockchain verification

#### Installation

#### 1. Create Virtual Environment

#### Windows

python -m venv venv
venv\Scripts\Activate.ps1

#### Mac/Linux

python3 -m venv venv
source venv/bin/activate

#### 2. Install Dependencies

powershell
pip install -r requirements.txt

#### 3. Setup PostgreSQL Database

**Using pgAdmin:**

1. Open pgAdmin
2. Right-click Databases → Create → Database
3. Name: `supply_chain_db`
4. Save

#### 4. Configure Environment Variables

Create `.env` file following the env.example file available in the project folder

**Important:** Replace `YOUR_PASSWORD` and contract address!

#### 5. Initialize Database

flask db init (already done)
flask db migrate -m "Initial tables" (already exist)
#### Just apply existing migrations:
flask db upgrade

#### 6. Run Backend

python run.py
Backend runs at: `http://localhost:5000`

#### API Endpoints

#### Health Check

http
GET /health
Response:
{
"status": "healthy",
"database": "connected",
"blockchain": "connected"
}

#### Users

**Create User**
http
POST /api/v1/users
Content-Type: application/json

**Get User**
http
GET /api/v1/users/{wallet_address}

#### Products

**Register Product**
http
POST /api/v1/products
Content-Type: application/json

**Get Product**
http
GET /api/v1/products/{product_id}

**Update Product Stage**
http
PUT /api/v1/products/{product_id}/stage
Content-Type: application/json

**Transfer Ownership**
http
POST /api/v1/products/{product_id}/transfer
Content-Type: application/json

**Verify Product**
http
POST /api/v1/products/{product_id}/verify
Content-Type: application/json

**Get Product History**
http
GET /api/v1/products/{product_id}/history

#### Development Workflow

1. **Start Hardhat Node** (Terminal 1)
2. **Start Backend** (Terminal 2)
3. **Test API**
   - Browser: `http://localhost:5000/health`

#### Making Database Changes

#### After modifying models

flask db migrate -m "Description of changes"
flask db upgrade

#### Adding New Packages

#### Install package

pip install package-name

#### Update requirements.txt

pip freeze > requirements.txt

## Supply Chain Frontend
