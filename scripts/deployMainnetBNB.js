const { ethers, run } = require("hardhat");
const { parseEther, formatEther } = require("@ethersproject/units");
const fs = require('fs');
const path = require('path');

// Production Wallets - REPLACE THESE WITH YOUR REAL PRODUCTION WALLET ADDRESSES
const TEAM_WALLET = "0x20be21a9a707d077fa78ac41b4fdbe511e20a8c7";
const ADVISOR_WALLET = "0x180434fe12c81eda170c458d6557bb1ee2d8315b";
const ECOSYSTEM_WALLET = "0x6b914426d873277001dbd0de24a7dd3bfcec4e32";
const MARKETING_WALLET = "0x87e5504fc3faa90d50d03949d4c7e22dab46c92b";

// BSC Mainnet Addresses
const BNB_USD_FEED = "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE"; // BSC Mainnet BNB/USD Chainlink feed
const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"; // BSC Mainnet USDT (Binance-Peg)

async function updateConfigFiles(addresses) {
  // 1. Update bscMainnet.json
  const deploymentsDir = path.join(__dirname, '../../web/src/deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentsDir, 'bscMainnet.json'),
    JSON.stringify({ contractAddresses: addresses }, null, 2)
  );
  console.log('Updated bscMainnet.json');

  // 2. Update BNBcontracts.js for mainnet
  const contractsJsPath = path.join(__dirname, '../../web/src/config/BNBcontracts.js');
  const contractsJsContent = fs.readFileSync(contractsJsPath, 'utf8');
  const updatedContractsJs = contractsJsContent
    .replace(/DEPLOYER_ADDRESS = ".*"/, `DEPLOYER_ADDRESS = "${addresses.TokenDeployer}"`)
    .replace(/MOVLY_ADDRESS = ".*"/, `MOVLY_ADDRESS = "${addresses.Movly}"`)
    .replace(/MGD_ADDRESS = ".*"/, `MGD_ADDRESS = "${addresses.MGD}"`)
    .replace(/USDT_ADDRESS = ".*"/, `USDT_ADDRESS = "${USDT_ADDRESS}"`);
  fs.writeFileSync(contractsJsPath, updatedContractsJs);
  console.log('Updated BNBcontracts.js');
}

async function main() {
  try {
    console.log("\n🚀 Starting deployment process on BSC Mainnet...");
    console.log("\n⚠️ IMPORTANT: This is deploying to MAINNET. Real funds will be used!");
    console.log("Press Ctrl+C now if this is not what you intended.");

    // 5 second delay to allow cancellation
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get deployer address
    const [deployer] = await ethers.getSigners();
    console.log("\nDeploying with account:", deployer.address);

    const provider = ethers.provider;
    const balance = await provider.getBalance(deployer.address);
    console.log("Account balance:", formatEther(balance), "BNB");

    if (parseFloat(formatEther(balance)) < 0.06) {
      throw new Error("Insufficient BNB balance. Please add more BNB to your account.");
    }

    // Double-check confirmation
    console.log("\n⚠️ FINAL WARNING: You're about to deploy to BSC MAINNET!");
    console.log("Wallet addresses being used:");
    console.log("- Team:", TEAM_WALLET);
    console.log("- Advisor:", ADVISOR_WALLET);
    console.log("- Ecosystem:", ECOSYSTEM_WALLET);
    console.log("- Marketing:", MARKETING_WALLET);

    // 5 more seconds to cancel
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Deploy TokenDeployer
    console.log("\n📄 Deploying TokenDeployer...");
    const TokenDeployer = await ethers.getContractFactory("TokenDeployer");

    // Deployment with constructor parameters
    const tokenDeployer = await TokenDeployer.deploy(
      BNB_USD_FEED,
      USDT_ADDRESS,
      TEAM_WALLET,
      ADVISOR_WALLET,
      ECOSYSTEM_WALLET,
      MARKETING_WALLET
    );

    // Wait for transaction to be confirmed
    const deployTx = await tokenDeployer.deploymentTransaction();
    if (!deployTx) {
      throw new Error("Deployment failed");
    }
    console.log("\nDeployment transaction hash:", deployTx.hash);
    console.log("Waiting for confirmation...");
    await deployTx.wait();

    // Get and show token addresses
    const movlyAddress = await tokenDeployer.movly();
    const mgdAddress = await tokenDeployer.mgd();
    console.log("\n📍 Contract Addresses:");
    console.log("TokenDeployer:", tokenDeployer.target);
    console.log("Movly:", movlyAddress);
    console.log("MGD:", mgdAddress);

    // Verify wallet settings
    console.log("\n👥 Wallet Addresses:");
    console.log("Team:", await tokenDeployer.teamWallet());
    console.log("Advisor:", await tokenDeployer.advisorWallet());
    console.log("Ecosystem:", await tokenDeployer.ecosystemWallet());
    console.log("Marketing:", await tokenDeployer.marketingWallet());

    // Update config files
    const addresses = {
      TokenDeployer: tokenDeployer.target,
      Movly: movlyAddress,
      MGD: mgdAddress
    };
    await updateConfigFiles(addresses);
    console.log("\n✅ All configuration files have been updated!");

    // Save deployment info to a separate file for reference
    const deploymentInfo = {
      network: "BSC Mainnet",
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      addresses: addresses,
      wallets: {
        team: TEAM_WALLET,
        advisor: ADVISOR_WALLET,
        ecosystem: ECOSYSTEM_WALLET,
        marketing: MARKETING_WALLET
      },
      constructorArguments: [
        BNB_USD_FEED,
        USDT_ADDRESS,
        TEAM_WALLET,
        ADVISOR_WALLET,
        ECOSYSTEM_WALLET,
        MARKETING_WALLET
      ]
    };

    // Ensure deployments directory exists
    const deploymentsDir = path.join(__dirname, '../deployments');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    fs.writeFileSync(
      path.join(deploymentsDir, 'mainnet-info.json'),
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\n✅ Deployment info saved to ../deployments/mainnet-info.json");

    console.log("\n🎉 Deployment to BSC Mainnet completed successfully!");
    console.log("\n⚠️ IMPORTANT: Please verify the following:");
    console.log("1. Token distribution is correct");
    console.log("2. Vesting schedules are set up properly");
    console.log("3. Update your frontend configuration if needed");
    console.log("4. Backup your deployment info (../deployments/mainnet-info.json)");
    console.log("\nNOTE: Contract verification was skipped. To verify contracts later, use:");
    console.log(`npx hardhat verify --network bscMainnet <TokenDeployer-Address> ${BNB_USD_FEED} ${USDT_ADDRESS} ${TEAM_WALLET} ${ADVISOR_WALLET} ${ECOSYSTEM_WALLET} ${MARKETING_WALLET}`);

  } catch (e) {
    console.error("\n❌ Deployment failed:", e.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  }); 