const { ethers, run } = require("hardhat");
const { formatEther } = require("@ethersproject/units");

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
    console.log("\n🚀 Starting deployment of MovlyOperations on BSC Testnet...");

    // Get the token address from environment
    const movlyTokenAddress = process.env.MOVLY_TOKEN_ADDRESS;
    if (!movlyTokenAddress) {
      throw new Error("MOVLY_TOKEN_ADDRESS not set in environment");
    }
    console.log("\nUsing Movly token address:", movlyTokenAddress);

    // Get the system wallet address from environment
    const systemWalletAddress = process.env.SYSTEM_WALLET_ADDRESS;
    if (!systemWalletAddress) {
      throw new Error("SYSTEM_WALLET_ADDRESS not set in environment");
    }
    console.log("Using system wallet address:", systemWalletAddress);

    // Get the signer address from environment
    const signerAddress = process.env.BACKEND_SIGNER_ADDRESS;
    if (!signerAddress) {
      throw new Error("BACKEND_SIGNER_ADDRESS not set in environment");
    }
    console.log("Using backend signer address:", signerAddress);

    // Get deployer address
    const [deployer] = await ethers.getSigners();
    console.log("\nDeploying with account:", deployer.address);

    const provider = ethers.provider;
    const balance = await provider.getBalance(deployer.address);
    console.log("Account balance:", formatEther(balance), "BNB");

    // Deploy MovlyOperations
    console.log("\n📄 Deploying MovlyOperations...");
    try {
      const MovlyOperations = await ethers.getContractFactory("MovlyOperations");
      console.log("Contract factory created");

      console.log("Deploying with parameters:");
      console.log("- Movly Token:", movlyTokenAddress);
      console.log("- System Wallet:", systemWalletAddress);
      console.log("- Backend Signer:", signerAddress);

      console.log("Deploying contract...");
      const operations = await MovlyOperations.deploy(
        movlyTokenAddress,
        systemWalletAddress,
        signerAddress
      );
      console.log("Deploy transaction sent");

      // Get contract address
      console.log("Contract address:", operations.address || operations.target);

      // Get transaction hash
      const txHash = operations.deployTransaction?.hash || operations.hash;
      console.log("Transaction hash:", txHash);

      console.log("Waiting for transaction to be mined...");
      const receipt = await ethers.provider.waitForTransaction(txHash);
      console.log("Transaction mined successfully, status:", receipt.status);

      console.log("\n📍 Contract Address:");
      console.log("MovlyOperations:", operations.address || operations.target);
      console.log("Transaction hash:", txHash);

      // Verify parameters
      console.log("\n⚙️ Contract Parameters:");
      console.log("Movly Token:", movlyTokenAddress);
      console.log("System Wallet:", systemWalletAddress);
      console.log("Backend Signer:", signerAddress);

      // Wait for a few blocks for BSCScan to index the contract
      console.log("\n⏳ Waiting for BSCScan to index the contract...");
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

      // Verify contract
      const contractAddress = operations.address || operations.target;
      await verifyContract(contractAddress, [
        movlyTokenAddress,
        systemWalletAddress,
        signerAddress
      ]);

      console.log("\n✅ Deployment completed successfully!");

    } catch (e) {
      console.error("\n❌ Deployment failed:", e.message);
      throw e;
    }
  } catch (e) {
    console.error("\n❌ Deployment failed:", e.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
