require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    hardhat: {
      chainId: 31337
    },
    ganache: {
      url: "http://127.0.0.1:7545",
      chainId: 1337,
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    opbnb_testnet: {
      url: "https://opbnb-testnet.nodereal.io/v1/64a9df0874fb4a93b9d0a3849de012d3",
      chainId: 5611,
      accounts: [process.env.PRIVATE_KEY || ""]
    },
    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: [process.env.PRIVATE_KEY || ""],
      gasPrice: 20000000000 // 20 gwei
    },
    bscMainnet: {
      url: "https://bsc-dataseed1.binance.org/",
      chainId: 56,
      accounts: [process.env.PRIVATE_KEY],
      gasPrice: 5000000000 // 5 gwei
    }
  },
  etherscan: {
    apiKey: {
      bscTestnet: "FZ6DMVYGF3W75PDGDZ4I9SVCBV6JP8D5UZ",
      bsc: "FZ6DMVYGF3W75PDGDZ4I9SVCBV6JP8D5UZ"
    }
  }
}; 