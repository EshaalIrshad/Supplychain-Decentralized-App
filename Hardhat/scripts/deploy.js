const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const SupplyChain = await hre.ethers.getContractFactory("SupplyChain");
  const supplyChain = await SupplyChain.deploy();
  await supplyChain.waitForDeployment(); //mine

  const address = supplyChain.target;
  console.log("SupplyChain deployed to:", address);
  console.log("Contract owner (deployer):", deployer.address);
  console.log("");
  console.log("Only this deployer wallet can call assignRole().");
  console.log("In MetaMask, import the deployer private key to assign roles.");
  console.log("Hardhat account #0 private key:");
  console.log(
    "  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  );

  // Write address to a JSON file so scripts can read it without copy-paste
  const outDir = path.join(__dirname, "..", "deployments");
  const outFile = path.join(outDir, "localhost.json");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  fs.writeFileSync(
    outFile,
    JSON.stringify({ address, deployer: deployer.address }, null, 2),
  );
  console.log("\nAddress saved to Hardhat/deployments/localhost.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
