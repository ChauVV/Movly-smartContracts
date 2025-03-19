const { ethers } = require("hardhat");

// Addresses from deployment
const DEPLOYER_ADDRESS = "0xE3c2bAe4B923AA3613618A13665Be8A140ecD637";

// Price Feed addresses
const BNB_USD_FEED = "0x0000000000000000000000000000000000000000";
const ETH_USD_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const WETH = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

// Wallet addresses
const TEAM_WALLET = "0x20be21a9a707d077fa78ac41b4fdbe511e20a8c7";
const ADVISOR_WALLET = "0x180434fe12c81eda170c458d6557bb1ee2d8315b";
const ECOSYSTEM_WALLET = "0x6b914426d873277001dbd0de24a7dd3bfcec4e32";
const MARKETING_WALLET = "0x87e5504fc3faa90d50d03949d4c7e22dab46c92b";

async function main() {
  try {
    console.log("\n🚀 Starting initialization process...");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("\nInitializing with account:", deployer.address);

    // Get contract instance
    const TokenDeployer = await ethers.getContractFactory("TokenDeployer");
    const tokenDeployer = TokenDeployer.attach(DEPLOYER_ADDRESS);

    console.log("\n📄 Initializing contract...");
    const tx = await tokenDeployer.initialize(
      BNB_USD_FEED,
      ETH_USD_FEED,
      USDT,
      WETH,
      TEAM_WALLET,
      ADVISOR_WALLET,
      ECOSYSTEM_WALLET,
      MARKETING_WALLET
    );

    console.log("Waiting for transaction confirmation...");
    await tx.wait();
    console.log("✅ Contract initialized successfully!");

    // Verify initialization
    const paused = await tokenDeployer.paused();
    const salePhase = await tokenDeployer.salePhase();
    console.log("\nContract state after initialization:");
    console.log("Paused:", paused);
    console.log("Sale Phase:", salePhase);

  } catch (e) {
    console.error("\n❌ Initialization failed:", e.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  }); 