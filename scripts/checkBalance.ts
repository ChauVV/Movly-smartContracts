import { ethers } from "hardhat";
import { formatEther } from "@ethersproject/units";

async function main() {
  try {
    // Get latest deployed contracts
    const [owner] = await ethers.getSigners();
    console.log("\n👤 Owner address:", owner.address);

    // Log all balances and info
    console.log("\n📊 Checking contract states...");

    const TokenDeployer = await ethers.getContractFactory("TokenDeployer");
    const HST = await ethers.getContractFactory("HST");

    // Get contract instances (thay địa chỉ mới từ kết quả deploy vào đây)
    const tokenDeployer = await TokenDeployer.attach("địa_chỉ_TokenDeployer_mới");
    const hst = await HST.attach("0x1C81aDdcE26B1a107e37e2a98917e61476d4ec4d");

    console.log("\n📍 Contract Addresses:");
    console.log("TokenDeployer:", tokenDeployer.target);
    console.log("HST:", hst.target);

    // Check token info
    const name = await hst.name();
    const symbol = await hst.symbol();
    const totalSupply = await hst.totalSupply();
    const balance = await hst.balanceOf(owner.address);

    console.log("\n💰 Token Info:");
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Total Supply:", formatEther(totalSupply));
    console.log("Owner Balance:", formatEther(balance));

  } catch (e: any) {
    console.error("\n❌ Check failed:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 