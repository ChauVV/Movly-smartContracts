// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract USDT is ERC20, Ownable {
    constructor() ERC20("Tether USD", "USDT") {
        // Mint 1 million USDT cho deployer để test
        _mint(msg.sender, 1_000_000 * 10 ** 18);
    }

    // Thêm function mint để có thể tạo thêm USDT cho test
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
