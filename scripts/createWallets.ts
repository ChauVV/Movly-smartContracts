import { ethers } from "hardhat";

async function main() {
  // Tạo 5 ví mới
  const wallets = [];
  for (let i = 0; i < 5; i++) {
    const wallet = ethers.Wallet.createRandom();
    wallets.push(wallet);
  }

  console.log("\n=== Thông tin các ví ===");
  console.log("\nOwner Wallet (dùng để deploy):");
  console.log("Address:", wallets[0].address);
  console.log("Private Key:", wallets[0].privateKey);

  console.log("\nTeam Wallet:");
  console.log("Address:", wallets[1].address);
  console.log("Private Key:", wallets[1].privateKey);

  console.log("\nAdvisor Wallet:");
  console.log("Address:", wallets[2].address);
  console.log("Private Key:", wallets[2].privateKey);

  console.log("\nEcosystem Wallet:");
  console.log("Address:", wallets[3].address);
  console.log("Private Key:", wallets[3].privateKey);

  console.log("\nMarketing Wallet:");
  console.log("Address:", wallets[4].address);
  console.log("Private Key:", wallets[4].privateKey);

  console.log("\n=== Cập nhật vào deployTest.ts ===");
  console.log(`const TEAM_WALLET = "${wallets[1].address}";`);
  console.log(`const ADVISOR_WALLET = "${wallets[2].address}";`);
  console.log(`const ECOSYSTEM_WALLET = "${wallets[3].address}";`);
  console.log(`const MARKETING_WALLET = "${wallets[4].address}";`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 