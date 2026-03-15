// ── Contract configuration ────────────────────────────────────────────────
// CONTRACT_ADDRESS: paste the address printed by
//   npx hardhat run scripts/deploy.js --network localhost
// into your Frontend/.env file as VITE_CONTRACT_ADDRESS.
// The value below is the default first-deploy address from Hardhat — it will
// be correct if you have never restarted the Hardhat node.

export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  '0x5FbDB2315678afecb367f032d93F642f64180aa3';

// Full ABI — must match SupplyChain.sol exactly.
// Function names are CASE-SENSITIVE: RegisterProduct has a capital R.
export const CONTRACT_ABI = [
  // ── Role management ───────────────────────────────────────
  'function assignRole(address user, uint8 role) public',
  'function getRole(address user) public view returns (uint8)',
  'function roles(address) public view returns (uint8)',

  // ── Product management ────────────────────────────────────
  // Capital R — matches the Solidity function name exactly
  'function RegisterProduct(uint256 id, string memory name) public',
  'function updateStage(uint256 id, uint8 stage) public',
  'function transferOwnership(uint256 id, address newOwner) public',

  // ── View / query ──────────────────────────────────────────
  'function products(uint256) public view returns (uint256 id, string name, address owner)',
  'function getProductHistory(uint256 id) public view returns (tuple(uint8 stage, uint256 timestamp, address updater)[])',
  'function verifyProduct(uint256 id, address supposedOwner) public view returns (bool)',

  // ── Events ────────────────────────────────────────────────
  'event ProductRegistered(uint256 id, string name, address owner)',
  'event StageUpdated(uint256 id, uint8 stage, address updater)',
  'event OwnershipTransferred(uint256 id, address previousOwner, address newOwner)',
];

// ── Enum mappings ─────────────────────────────────────────────────────────
export const ROLES = { 0: 'None', 1: 'Manufacturer', 2: 'Distributor', 3: 'Retailer', 4: 'Consumer' };
export const ROLE_NUMS = { None: 0, Manufacturer: 1, Distributor: 2, Retailer: 3, Consumer: 4 };

export const STAGES = { 0: 'Registered', 1: 'Manufactured', 2: 'Shipped', 3: 'Delivered', 4: 'Sold' };
export const STAGE_NUMS = { Registered: 0, Manufactured: 1, Shipped: 2, Delivered: 3, Sold: 4 };

// Valid next stages for each current stage
export const NEXT_STAGES = {
  Registered:   ['Manufactured'],
  Manufactured: ['Shipped'],
  Shipped:      ['Delivered'],
  Delivered:    ['Sold'],
  Sold:         [],
};

export const API_BASE = '/api/v1';
