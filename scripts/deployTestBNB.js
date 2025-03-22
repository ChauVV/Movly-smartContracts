const { ethers, run } = require("hardhat");
const { parseEther, formatEther } = require("@ethersproject/units");
const fs = require('fs');
const path = require('path');

// Test Wallets
const TEAM_WALLET = "0x20be21a9a707d077fa78ac41b4fdbe511e20a8c7";
const ADVISOR_WALLET = "0x180434fe12c81eda170c458d6557bb1ee2d8315b";
const ECOSYSTEM_WALLET = "0x6b914426d873277001dbd0de24a7dd3bfcec4e32";
const MARKETING_WALLET = "0x87e5504fc3faa90d50d03949d4c7e22dab46c92b";

// BSC Testnet Addresses
const BNB_USD_FEED = "0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526";
const USDT = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";

async function updateConfigFiles(addresses) {
  // 1. Update bscTestnet.json
  const deploymentsDir = path.join(__dirname, '../../web/src/deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentsDir, 'bscTestnet.json'),
    JSON.stringify({ contractAddresses: addresses }, null, 2)
  );
  console.log('Updated bscTestnet.json');

  // 2. Update BNBcontracts.js
  const contractsJsPath = path.join(__dirname, '../../web/src/config/BNBcontracts.js');
  const contractsJsContent = fs.readFileSync(contractsJsPath, 'utf8');
  const updatedContractsJs = contractsJsContent
    .replace(/DEPLOYER_ADDRESS = ".*"/, `DEPLOYER_ADDRESS = "${addresses.TokenDeployer}"`)
    .replace(/HST_ADDRESS = ".*"/, `HST_ADDRESS = "${addresses.Movly}"`)
    .replace(/HSE_ADDRESS = ".*"/, `HSE_ADDRESS = "${addresses.MGD}"`);
  fs.writeFileSync(contractsJsPath, updatedContractsJs);
  console.log('Updated BNBcontracts.js');
}

async function verifyContract(address, constructorArguments) {
  console.log("\n🔍 Verifying contract...");
  try {
    await run("verify:verify", {
      address: address,
      constructorArguments: constructorArguments
    });
    console.log("✅ Contract verified successfully");
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract is already verified!");
    } else {
      console.error("❌ Error verifying contract:", error);
    }
  }
}

async function main() {
  try {
    console.log("\n🚀 Starting deployment process on BSC Testnet...");

    // Get deployer address
    const [deployer] = await ethers.getSigners();
    console.log("\nDeploying with account:", deployer.address);

    const provider = ethers.provider;
    const balance = await provider.getBalance(deployer.address);
    console.log("Account balance:", formatEther(balance), "BNB");

    // Deploy TokenDeployer
    console.log("\n📄 Deploying TokenDeployer...");
    const TokenDeployer = await ethers.getContractFactory("TokenDeployer");

    // Update constructor parameters to match contract's constructor
    const tokenDeployer = await TokenDeployer.deploy(
      BNB_USD_FEED,
      USDT,
      TEAM_WALLET,
      ADVISOR_WALLET,
      ECOSYSTEM_WALLET,
      MARKETING_WALLET
    );

    // Đợi transaction được confirm
    const deployTx = await tokenDeployer.deploymentTransaction();
    if (!deployTx) {
      throw new Error("Deployment failed");
    }
    await deployTx.wait();

    // Get và show token addresses
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

    // Verify contracts
    await verifyContract(tokenDeployer.target, [
      BNB_USD_FEED,
      USDT,
      TEAM_WALLET,
      ADVISOR_WALLET,
      ECOSYSTEM_WALLET,
      MARKETING_WALLET
    ]);

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