// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SupplyChain {

    // ── Ownership ─────────────────────────────────────────────────────────
    // The deployer becomes the contract owner.
    // Only the owner can assign roles to wallets.
    address public contractOwner;

    constructor() {
        contractOwner = msg.sender;
    }

    modifier onlyContractOwner() {
        require(msg.sender == contractOwner, "Only contract owner can assign roles");
        _;
    }

    // ── Roles & access control ────────────────────────────────────────────
    enum Role { None, Manufacturer, Distributor, Retailer, Consumer }

    mapping(address => Role) public roles;

    modifier onlyRole(Role _role) {
        require(roles[msg.sender] == _role, "Not authorized for this action");
        _;
    }

    // Only the contract owner (deployer) can assign roles.
    // In the assignment context this is the lecturer / admin wallet.
    function assignRole(address user, Role role) public onlyContractOwner {
        roles[user] = role;
    }

    function getRole(address user) public view returns (Role) {
        return roles[user];
    }

    // ── Product & tracking ────────────────────────────────────────────────
    enum Stage { Registered, Manufactured, Shipped, Delivered, Sold }

    struct StatusUpdate {
        Stage   stage;
        uint    timestamp;
        address updater;
    }

    struct Product {
        uint          id;
        string        name;
        address       owner;
        Stage         currentStage;   // <-- added so we can read it without history
        StatusUpdate[] history;
    }

    mapping(uint => Product) public products;

    // ── Events ────────────────────────────────────────────────────────────
    event ProductRegistered(uint id, string name, address owner);
    event StageUpdated(uint id, Stage stage, address updater);
    event OwnershipTransferred(uint id, address previousOwner, address newOwner);

    // ── Product functions ─────────────────────────────────────────────────

    function RegisterProduct(uint id, string memory name)
        public onlyRole(Role.Manufacturer)
    {
        require(products[id].owner == address(0), "Product already exists");

        Product storage p = products[id];
        p.id           = id;
        p.name         = name;
        p.owner        = msg.sender;
        p.currentStage = Stage.Registered;
        p.history.push(StatusUpdate(Stage.Registered, block.timestamp, msg.sender));

        emit ProductRegistered(id, name, msg.sender);
    }

    // Enforce that stages can only advance in order:
    // Registered -> Manufactured -> Shipped -> Delivered -> Sold
    function updateStage(uint id, Stage newStage) public {
        Product storage p = products[id];
        require(p.owner != address(0), "Product does not exist");
        require(msg.sender == p.owner, "Only current owner can update stage");

        // newStage must be exactly one step ahead of currentStage
        require(
            uint(newStage) == uint(p.currentStage) + 1,
            "Invalid stage transition: stages must advance in order"
        );

        p.currentStage = newStage;
        p.history.push(StatusUpdate(newStage, block.timestamp, msg.sender));
        emit StageUpdated(id, newStage, msg.sender);
    }

    function transferOwnership(uint id, address newOwner) public {
        Product storage p = products[id];
        require(p.owner != address(0), "Product does not exist");
        require(msg.sender == p.owner, "Only current owner can transfer");
        require(newOwner != address(0), "New owner cannot be zero address");

        address oldOwner = p.owner;
        p.owner = newOwner;
        emit OwnershipTransferred(id, oldOwner, newOwner);
    }

    // ── View functions ────────────────────────────────────────────────────

    // Returns the current stage without fetching full history
    function getCurrentStage(uint id) public view returns (Stage) {
        require(products[id].owner != address(0), "Product does not exist");
        return products[id].currentStage;
    }

    function getProductHistory(uint id) public view returns (StatusUpdate[] memory) {
        require(products[id].owner != address(0), "Product does not exist");
        return products[id].history;
    }

    function verifyProduct(uint id, address supposedOwner) public view returns (bool) {
        require(products[id].owner != address(0), "Product does not exist");
        return products[id].owner == supposedOwner;
    }
}
