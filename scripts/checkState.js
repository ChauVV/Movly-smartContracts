const { ethers } = require("hardhat");

// Contract address
const DEPLOYER_ADDRESS = "0xE3c2bAe4B923AA3613618A13665Be8A140ecD637";

async function main() {
  try {
    console.log("\n🔍 Checking contract state...");

    // Get contract instance
    const TokenDeployer = await ethers.getContractFactory("TokenDeployer");
    const tokenDeployer = TokenDeployer.attach(DEPLOYER_ADDRESS);

    // Check basic state
    const paused = await tokenDeployer.paused();
    const salePhase = await tokenDeployer.salePhase();
    const owner = await tokenDeployer.owner();

    console.log("\nBasic State:");
    console.log("Paused:", paused);
    console.log("Sale Phase:", salePhase);
    console.log("Owner:", owner);

    // Check price feeds
    try {
      const ethPrice = await tokenDeployer.getETHPrice();
      console.log("\nETH Price:", ethPrice.toString());
    } catch (e) {
      console.log("\nFailed to get ETH price:", e.message);
    }

    // Check wallets
    console.log("\nWallet Addresses:");
    console.log("Team:", await tokenDeployer.teamWallet());
    console.log("Advisor:", await tokenDeployer.advisorWallet());
    console.log("Ecosystem:", await tokenDeployer.ecosystemWallet());
    console.log("Marketing:", await tokenDeployer.marketingWallet());

  } catch (e) {
    console.error("\n❌ Check failed:", e.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  }); 