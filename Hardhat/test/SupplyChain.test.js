const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SupplyChain Contract", function () {
  let supplyChain;
  let contractOwner, manufacturer, distributor, retailer, consumer, stranger;

  beforeEach(async function () {
    [contractOwner, manufacturer, distributor, retailer, consumer, stranger] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("SupplyChain");
    supplyChain = await Factory.deploy();
    await supplyChain.waitForDeployment();

    // Only contractOwner can assign roles — all setup goes through owner
    await supplyChain
      .connect(contractOwner)
      .assignRole(manufacturer.address, 1);
    await supplyChain.connect(contractOwner).assignRole(distributor.address, 2);
    await supplyChain.connect(contractOwner).assignRole(retailer.address, 3);
    await supplyChain.connect(contractOwner).assignRole(consumer.address, 4);
  });

  // ── DEPLOYMENT
  describe("Deployment", function () {
    it("Should deploy and set contractOwner to deployer", async function () {
      expect(await supplyChain.contractOwner()).to.equal(contractOwner.address);
    });
  });

  // ── ROLE ASSIGNMENT
  describe("assignRole", function () {
    it("Owner can assign roles", async function () {
      const role = await supplyChain.getRole(manufacturer.address);
      expect(role).to.equal(1); // Manufacturer
    });

    it("Non-owner CANNOT assign roles", async function () {
      await expect(
        supplyChain.connect(stranger).assignRole(stranger.address, 1),
      ).to.be.revertedWith("Only contract owner can assign roles");
    });

    it("Owner can reassign a role", async function () {
      // Promote distributor to manufacturer
      await supplyChain
        .connect(contractOwner)
        .assignRole(distributor.address, 1);
      expect(await supplyChain.getRole(distributor.address)).to.equal(1);
    });
  });

  // ── REGISTER PRODUCT ────────────────────────────────────────────────────
  describe("RegisterProduct", function () {
    it("Manufacturer can register a product", async function () {
      await supplyChain.connect(manufacturer).RegisterProduct(1, "Laptop");
      const product = await supplyChain.products(1);
      expect(product.name).to.equal("Laptop");
      expect(product.owner).to.equal(manufacturer.address);
    });

    it("Registration sets initial stage to Registered (0)", async function () {
      await supplyChain.connect(manufacturer).RegisterProduct(1, "Phone");
      const stage = await supplyChain.getCurrentStage(1);
      expect(stage).to.equal(0); // Stage.Registered
    });

    it("Registration writes first history entry", async function () {
      await supplyChain.connect(manufacturer).RegisterProduct(1, "Phone");
      const history = await supplyChain.getProductHistory(1);
      expect(history.length).to.equal(1);
      expect(history[0].stage).to.equal(0);
    });

    it("Non-manufacturer CANNOT register a product", async function () {
      await expect(
        supplyChain.connect(consumer).RegisterProduct(2, "Tablet"),
      ).to.be.revertedWith("Not authorized for this action");
    });

    it("Duplicate product ID is rejected", async function () {
      await supplyChain.connect(manufacturer).RegisterProduct(1, "Laptop");
      await expect(
        supplyChain.connect(manufacturer).RegisterProduct(1, "Laptop2"),
      ).to.be.revertedWith("Product already exists");
    });
  });

  // ── UPDATE STAGE ────────────────────────────────────────────────────────
  describe("updateStage", function () {
    beforeEach(async function () {
      await supplyChain.connect(manufacturer).RegisterProduct(1, "TV");
    });

    it("Owner can advance to next stage in order", async function () {
      await supplyChain.connect(manufacturer).updateStage(1, 1); // -> Manufactured
      const stage = await supplyChain.getCurrentStage(1);
      expect(stage).to.equal(1);
    });

    it("History grows with each stage update", async function () {
      await supplyChain.connect(manufacturer).updateStage(1, 1);
      const history = await supplyChain.getProductHistory(1);
      expect(history.length).to.equal(2);
      expect(history[1].stage).to.equal(1);
    });

    it("CANNOT skip a stage (Registered -> Shipped)", async function () {
      await expect(
        supplyChain.connect(manufacturer).updateStage(1, 2), // skip Manufactured
      ).to.be.revertedWith(
        "Invalid stage transition: stages must advance in order",
      );
    });

    it("CANNOT go backwards (Manufactured -> Registered)", async function () {
      await supplyChain.connect(manufacturer).updateStage(1, 1); // -> Manufactured
      await expect(
        supplyChain.connect(manufacturer).updateStage(1, 0), // back to Registered
      ).to.be.revertedWith(
        "Invalid stage transition: stages must advance in order",
      );
    });

    it("Non-owner CANNOT update stage", async function () {
      await expect(
        supplyChain.connect(distributor).updateStage(1, 1),
      ).to.be.revertedWith("Only current owner can update stage");
    });

    it("Updating stage on non-existent product fails", async function () {
      await expect(
        supplyChain.connect(manufacturer).updateStage(99, 1),
      ).to.be.revertedWith("Product does not exist");
    });

    it("Full journey: Registered -> Manufactured -> Shipped -> Delivered -> Sold", async function () {
      await supplyChain.connect(manufacturer).updateStage(1, 1); // Manufactured
      await supplyChain.connect(manufacturer).updateStage(1, 2); // Shipped
      await supplyChain.connect(manufacturer).updateStage(1, 3); // Delivered
      await supplyChain.connect(manufacturer).updateStage(1, 4); // Sold
      expect(await supplyChain.getCurrentStage(1)).to.equal(4);
      expect((await supplyChain.getProductHistory(1)).length).to.equal(5);
    });
  });

  // ── TRANSFER OWNERSHIP
  describe("transferOwnership", function () {
    beforeEach(async function () {
      await supplyChain.connect(manufacturer).RegisterProduct(1, "Camera");
    });

    it("Owner can transfer to another address", async function () {
      await supplyChain
        .connect(manufacturer)
        .transferOwnership(1, distributor.address);
      const product = await supplyChain.products(1);
      expect(product.owner).to.equal(distributor.address);
    });

    it("New owner can update stage after transfer", async function () {
      await supplyChain
        .connect(manufacturer)
        .transferOwnership(1, distributor.address);
      await supplyChain.connect(distributor).updateStage(1, 1); // Manufactured
      expect(await supplyChain.getCurrentStage(1)).to.equal(1);
    });

    it("Non-owner CANNOT transfer", async function () {
      await expect(
        supplyChain.connect(consumer).transferOwnership(1, retailer.address),
      ).to.be.revertedWith("Only current owner can transfer");
    });

    it("CANNOT transfer to zero address", async function () {
      await expect(
        supplyChain
          .connect(manufacturer)
          .transferOwnership(1, ethers.ZeroAddress),
      ).to.be.revertedWith("New owner cannot be zero address");
    });
  });

  // ── GET PRODUCT HISTORY
  describe("getProductHistory", function () {
    it("Returns full history across stage updates", async function () {
      await supplyChain.connect(manufacturer).RegisterProduct(1, "Shoes");
      await supplyChain.connect(manufacturer).updateStage(1, 1);
      await supplyChain.connect(manufacturer).updateStage(1, 2);
      const history = await supplyChain.getProductHistory(1);
      expect(history.length).to.equal(3);
    });

    it("Fails for non-existent product", async function () {
      await expect(supplyChain.getProductHistory(10)).to.be.revertedWith(
        "Product does not exist",
      );
    });
  });

  // ── GET CURRENT STAGE
  describe("getCurrentStage", function () {
    it("Returns Registered immediately after registration", async function () {
      await supplyChain.connect(manufacturer).RegisterProduct(1, "Watch");
      expect(await supplyChain.getCurrentStage(1)).to.equal(0);
    });

    it("Updates after each stage change", async function () {
      await supplyChain.connect(manufacturer).RegisterProduct(1, "Watch");
      await supplyChain.connect(manufacturer).updateStage(1, 1);
      expect(await supplyChain.getCurrentStage(1)).to.equal(1);
    });

    it("Fails for non-existent product", async function () {
      await expect(supplyChain.getCurrentStage(99)).to.be.revertedWith(
        "Product does not exist",
      );
    });
  });

  // ── VERIFY PRODUCT
  describe("verifyProduct", function () {
    beforeEach(async function () {
      await supplyChain.connect(manufacturer).RegisterProduct(1, "Watch");
    });

    it("Returns true for the real owner", async function () {
      expect(await supplyChain.verifyProduct(1, manufacturer.address)).to.equal(
        true,
      );
    });

    it("Returns false for the wrong address", async function () {
      expect(await supplyChain.verifyProduct(1, distributor.address)).to.equal(
        false,
      );
    });

    it("Returns false after ownership is transferred", async function () {
      await supplyChain
        .connect(manufacturer)
        .transferOwnership(1, distributor.address);
      expect(await supplyChain.verifyProduct(1, manufacturer.address)).to.equal(
        false,
      );
      expect(await supplyChain.verifyProduct(1, distributor.address)).to.equal(
        true,
      );
    });

    it("Fails for non-existent product", async function () {
      await expect(
        supplyChain.verifyProduct(5, consumer.address),
      ).to.be.revertedWith("Product does not exist");
    });
  });
});
