// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Movly Token (MOVLY)
 * @dev Governance token for the Movly ecosystem with fixed supply
 */
contract Movly is ERC20, Ownable {
    uint256 public constant MAX_SUPPLY = 5000000000 * 10 ** 18; // 5 billion tokens

    /**
     * @dev Constructor that mints all tokens at deployment and assigns them to deployer
     */
    constructor() ERC20("Movly", "MOVLY") Ownable() {
        // Mint all tokens to deployer
        _mint(msg.sender, MAX_SUPPLY);
    }
}
