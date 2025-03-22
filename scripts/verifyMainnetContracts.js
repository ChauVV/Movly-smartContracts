const { run } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function verifyContract(address, constructorArguments) {
  console.log(`🔍 Verifying contract at address ${address}...`);
  try {
    await run("verify:verify", {
      address: address,
      constructorArguments: constructorArguments
    });
    console.log("✅ Contract verified successfully");
    return true;
  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("Contract is already verified!");
      return true;
    } else {
      console.error("❌ Error verifying contract:", error);
      return false;
    }
  }
}

async function main() {
  try {
    console.log("\n🚀 Starting verification process for BSC Mainnet contracts...");

    // Đọc thông tin deployment từ file
    let deploymentInfo;
    const deploymentPath = path.join(__dirname, '../deployments/mainnet-info.json');

    if (fs.existsSync(deploymentPath)) {
      deploymentInfo = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
      console.log(`\n📄 Loaded deployment info from ${deploymentPath}`);
    } else {
      throw new Error(`Deployment info file not found at ${deploymentPath}`);
    }

    // Lấy địa chỉ contract và tham số constructor
    const tokenDeployerAddress = deploymentInfo.addresses.TokenDeployer;
    const constructorArgs = deploymentInfo.constructorArguments;

    console.log("\n📍 Contract Addresses:");
    console.log("TokenDeployer:", tokenDeployerAddress);
    console.log("Movly:", deploymentInfo.addresses.Movly);
    console.log("MGD:", deploymentInfo.addresses.MGD);

    console.log("\n🔄 Constructor Arguments:");
    console.log("- BNB/USD Feed:", constructorArgs[0]);
    console.log("- USDT Address:", constructorArgs[1]);
    console.log("- Team Wallet:", constructorArgs[2]);
    console.log("- Advisor Wallet:", constructorArgs[3]);
    console.log("- Ecosystem Wallet:", constructorArgs[4]);
    console.log("- Marketing Wallet:", constructorArgs[5]);

    // Xác minh contract
    console.log("\n🔍 Starting verification process...");
    console.log("Note: Only TokenDeployer needs to be verified. Movly and MGD contracts will be verified automatically as they are created by TokenDeployer.");

    console.log("\nWaiting 5 seconds before proceeding...");
    await new Promise(resolve => setTimeout(resolve, 5000));

    const success = await verifyContract(tokenDeployerAddress, constructorArgs);

    if (success) {
      console.log("\n✅ Verification process completed successfully.");
      console.log("You can now see the verified contract on BSCScan:");
      console.log(`https://bscscan.com/address/${tokenDeployerAddress}#code`);

      // Cập nhật trạng thái xác minh trong deployment info
      deploymentInfo.verification = "completed";
      fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
      console.log("\n✅ Updated verification status in deployment info file.");
    } else {
      console.error("\n❌ Verification process failed.");
      console.log("You can try again later or verify manually on BSCScan.");
    }

  } catch (e) {
    console.error("\n❌ Verification failed:", e.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  }); 