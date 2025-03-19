const TokenDeployer = artifacts.require("TokenDeployer");
const HST = artifacts.require("HST");
const HSE = artifacts.require("HSE");
const USDT = artifacts.require("USDT");
const MockPriceFeed = artifacts.require("MockPriceFeed");

module.exports = function (deployer, network) {
  if (network === 'ganache') {
    // Đăng ký các contract đã deploy với địa chỉ từ deployTest.js
    TokenDeployer.address = "0x7882a5B13Efe40c185CA80fFf957643350501Da8";
    HST.address = "0x3861E91F471792776680dF5d57D8aB911Ae22801";
    HSE.address = "0xDb1A656D25F18c25232D9cd3F0BDE80C1C3fe6F8";
    USDT.address = "0x00F1C510fBf69198283752BDC75700330B745176"; // Thêm địa chỉ USDT từ deployTest.js
  }
}; 