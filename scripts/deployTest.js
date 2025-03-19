const { ethers, run } = require("hardhat");
const { parseEther, formatEther } = require("@ethersproject/units");
const fs = require('fs');
const path = require('path');

// Test Wallets
const TEAM_WALLET = "0x20be21a9a707d077fa78ac41b4fdbe511e20a8c7";
const ADVISOR_WALLET = "0x180434fe12c81eda170c458d6557bb1ee2d8315b";
const ECOSYSTEM_WALLET = "0x6b914426d873277001dbd0de24a7dd3bfcec4e32";
const MARKETING_WALLET = "0x87e5504fc3faa90d50d03949d4c7e22dab46c92b";

// Initial prices for mock feeds (8 decimals)
const INITIAL_ETH_PRICE = 200000000000; // $2000.00000000
const INITIAL_BNB_PRICE = 30000000000;  // $300.00000000

async function updateConfigFiles(addresses) {
  // 1. Update localhost.json
  const deploymentsDir = path.join(__dirname, '../../web/src/deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentsDir, 'localhost.json'),
    JSON.stringify({ contractAddresses: addresses }, null, 2)
  );
  console.log('Updated localhost.json');

  // 2. Update contracts.js
  const contractsJsPath = path.join(__dirname, '../../web/src/config/contracts.js');
  const contractsJsContent = fs.readFileSync(contractsJsPath, 'utf8');
  const updatedContractsJs = contractsJsContent
    .replace(/DEPLOYER_ADDRESS = ".*"/, `DEPLOYER_ADDRESS = "${addresses.TokenDeployer}"`)
    .replace(/HST_ADDRESS = ".*"/, `HST_ADDRESS = "${addresses.HST}"`)
    .replace(/HSE_ADDRESS = ".*"/, `HSE_ADDRESS = "${addresses.HSE}"`)
    .replace(/USDT_ADDRESS = ".*"/, `USDT_ADDRESS = "${addresses.USDT}"`);
  fs.writeFileSync(contractsJsPath, updatedContractsJs);
  console.log('Updated contracts.js');

  // 3. Update 1_deploy.js
  const deployJsPath = path.join(__dirname, '../migrations/1_deploy.js');
  const deployJsContent = fs.readFileSync(deployJsPath, 'utf8');
  const updatedDeployJs = deployJsContent
    .replace(/TokenDeployer\.address = ".*"/, `TokenDeployer.address = "${addresses.TokenDeployer}"`)
    .replace(/HST\.address = ".*"/, `HST.address = "${addresses.HST}"`)
    .replace(/HSE\.address = ".*"/, `HSE.address = "${addresses.HSE}"`)
    .replace(/USDT\.address = ".*"/, `USDT.address = "${addresses.USDT}"`);
  fs.writeFileSync(deployJsPath, updatedDeployJs);
  console.log('Updated 1_deploy.js');
}

async function main() {
  try {
    console.log("\n🚀 Starting deployment process...");

    // Get deployer address
    const [deployer] = await ethers.getSigners();
    console.log("\nDeploying with account:", deployer.address);

    const provider = ethers.provider;
    const balance = await provider.getBalance(deployer.address);
    console.log("Account balance:", formatEther(balance), "ETH");

    // Deploy Mock Price Feeds first
    console.log("\n📈 Deploying Mock Price Feeds...");
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");

    const mockEthFeed = await MockPriceFeed.deploy(INITIAL_ETH_PRICE);
    await mockEthFeed.deploymentTransaction().wait();
    console.log("Mock ETH/USD Feed deployed to:", mockEthFeed.target);

    const mockBnbFeed = await MockPriceFeed.deploy(INITIAL_BNB_PRICE);
    await mockBnbFeed.deploymentTransaction().wait();
    console.log("Mock BNB/USD Feed deployed to:", mockBnbFeed.target);

    // Deploy USDT first
    console.log("\n💵 Deploying USDT...");
    const USDTContract = await ethers.getContractFactory("USDT");
    const usdt = await USDTContract.deploy();
    await usdt.deploymentTransaction().wait();
    console.log("USDT deployed to:", usdt.target);

    // Sử dụng địa chỉ 0 cho WETH vì chúng ta không cần nó trong test
    const WETH_ADDRESS = "0x0000000000000000000000000000000000000000";

    // Deploy TokenDeployer
    console.log("\n📄 Deploying TokenDeployer...");
    const TokenDeployer = await ethers.getContractFactory("TokenDeployer");
    const tokenDeployer = await TokenDeployer.deploy(
      mockBnbFeed.target,
      mockEthFeed.target,
      usdt.target,
      WETH_ADDRESS,  // Sử dụng địa chỉ 0 cho WETH
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
    const hstAddress = await tokenDeployer.hst();
    const hseAddress = await tokenDeployer.hse();
    console.log("\n📍 Contract Addresses:");
    console.log("TokenDeployer:", tokenDeployer.target);
    console.log("HST:", hstAddress);
    console.log("HSE:", hseAddress);

    // Verify wallet settings
    console.log("\n👥 Wallet Addresses:");
    console.log("Team:", await tokenDeployer.teamWallet());
    console.log("Advisor:", await tokenDeployer.advisorWallet());
    console.log("Ecosystem:", await tokenDeployer.ecosystemWallet());
    console.log("Marketing:", await tokenDeployer.marketingWallet());

    // Test price feed
    const ethPrice = await tokenDeployer.getETHPrice();
    console.log("\n💲 ETH Price from mock feed:", ethPrice.toString());

    // Update all config files with USDT address
    const addresses = {
      TokenDeployer: tokenDeployer.target,
      HST: hstAddress,
      HSE: hseAddress,
      USDT: usdt.target,  // Add USDT address
      MockETHFeed: mockEthFeed.target,
      MockBNBFeed: mockBnbFeed.target
    };
    await updateConfigFiles(addresses);
    console.log("\n✅ All configuration files have been updated!");

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