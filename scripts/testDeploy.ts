import { ethers } from "hardhat";
import { formatEther, parseEther } from "@ethersproject/units";

async function main() {
  try {
    const [owner, buyer] = await ethers.getSigners();
    console.log("\n👤 Testing with accounts:");
    console.log("Owner:", owner.address);
    console.log("Buyer:", buyer.address);

    // Lấy contract đã deploy
    const tokenDeployer = await ethers.getContractAt(
      "TokenDeployer",
      "0xcCe7136C581811aC9D6375F9e21C4eAA3e05e96B"  // Địa chỉ contract vừa deploy
    );

    // Test 1: Check presale status
    console.log("\n🔍 Testing presale status...");
    const isPresaleActive = await tokenDeployer.presaleActive();
    console.log("Presale active:", isPresaleActive);

    // Test 2: Start presale
    if (!isPresaleActive) {
      console.log("\n▶️ Starting presale...");
      await tokenDeployer.startPresale();
      console.log("Presale started!");
    }

    // Test 3: Buy tokens with USDT
    console.log("\n💰 Testing token purchase...");
    const usdtAmount = parseEther("1000"); // 1000 USDT
    await tokenDeployer.connect(buyer).buyTokensWithUSDT(usdtAmount);

    // Check buyer balance
    const hst = await ethers.getContractAt("HST", await tokenDeployer.hst());
    const buyerBalance = await hst.balanceOf(buyer.address);
    console.log("Buyer HST balance:", formatEther(buyerBalance));

  } catch (e: any) {
    console.error("\n❌ Test failed:", e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 