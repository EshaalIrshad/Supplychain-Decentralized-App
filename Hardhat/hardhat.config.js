require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",

  networks: {
    // Run:  npx hardhat node
    // Then: npx hardhat run scripts/deploy.js --network localhost
    localhost: {
      url: "http://127.0.0.1:8545",
      // Hardhat auto-provides accounts — no private key needed here
    },
  },
};
