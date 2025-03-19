const { ethers } = require("hardhat");
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Hàm để lấy địa chỉ Mock ETH Feed từ lần deploy gần nhất
async function getMockFeedAddress() {
  try {
    // Đọc file deployment config
    const configPath = path.join(__dirname, '../../web/src/deployments/localhost.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Lấy địa chỉ Mock ETH Feed từ config
    const mockFeedAddress = config.contractAddresses.MockETHFeed;
    if (!mockFeedAddress) {
      throw new Error('Mock ETH Feed address not found in config');
    }
    return mockFeedAddress;
  } catch (error) {
    console.error('Error getting Mock Feed address:', error);
    process.exit(1);
  }
}

async function getETHPrice() {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const price = response.data.ethereum.usd;
    // Convert to 8 decimals format
    return Math.round(price * 100000000);
  } catch (error) {
    console.error('Error fetching ETH price:', error);
    return null;
  }
}

async function updatePrice() {
  try {
    // Get deployer account
    const [deployer] = await ethers.getSigners();

    // Get Mock Feed address
    const mockFeedAddress = await getMockFeedAddress();
    console.log('Using Mock ETH Feed at:', mockFeedAddress);

    // Get contract instance
    const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
    const priceFeed = MockPriceFeed.attach(mockFeedAddress);

    // Get current ETH price
    const newPrice = await getETHPrice();
    if (!newPrice) return;

    // Update price in contract
    const tx = await priceFeed.setPrice(newPrice);
    await tx.wait();

    console.log(`Updated ETH price to $${newPrice / 100000000}`);
  } catch (error) {
    console.error('Error updating price:', error);
  }
}

// Update price every 1 minute
console.log('Starting price update service...');
updatePrice(); // Run immediately first time
setInterval(updatePrice, 60000); 