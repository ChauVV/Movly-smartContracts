// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract HST is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 5000000000 * 10 ** 18; // 5 billion tokens

    constructor() ERC20("Health Step Token", "HST") Ownable() {
        _mint(msg.sender, MAX_SUPPLY);
    }
}
