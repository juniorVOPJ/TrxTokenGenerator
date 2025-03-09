require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "london"
    }
  },
  networks: {
    tron: {
      url: process.env.TRON_MAINNET_URL,
      network_id: "1",
      accounts: [process.env.TRON_PRIVATE_KEY],
      userFeePercentage: 100,
      feeLimit: 100000000,
      originEnergyLimit: 10000000,
      fullHost: process.env.TRON_MAINNET_URL,
      headers: {
        "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};