const { ethers } = require("hardhat");
const { parseUnits } = require("ethers");
const fs = require('fs');
const path = require('path');

async function main() {
  try {
    // Đọc địa chỉ USDT từ file config
    const configPath = path.join(__dirname, '../../web/src/config/contracts.js');
    const configContent = fs.readFileSync(configPath, 'utf8');

    // Tìm USDT_ADDRESS trong config
    const usdtAddressMatch = configContent.match(/USDT_ADDRESS = "([^"]+)"/);
    if (!usdtAddressMatch) {
      throw new Error("USDT_ADDRESS not found in config file");
    }
    const USDT_ADDRESS = usdtAddressMatch[1];

    // Địa chỉ ví nhận USDT (thay bằng địa chỉ ví của bạn)
    const WALLET_ADDRESS = "0xB24BA6c8aD23BA5c0936880b3f430a0C96d4f3B5";

    console.log("USDT Contract Address:", USDT_ADDRESS);
    console.log("Wallet Address:", WALLET_ADDRESS);

    // Lấy USDT contract
    const USDT = await ethers.getContractFactory("USDT");
    const usdt = await USDT.attach(USDT_ADDRESS);

    console.log("Minting USDT...");
    // Mint 1000 USDT
    const tx = await usdt.mint(WALLET_ADDRESS, parseUnits("1000", 18));
    await tx.wait();

    // Kiểm tra balance
    const balance = await usdt.balanceOf(WALLET_ADDRESS);
    console.log(`USDT minted successfully!`);
    console.log(`New balance: ${ethers.formatUnits(balance, 18)} USDT`);

  } catch (error) {
    console.error("Error minting USDT:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  }); 