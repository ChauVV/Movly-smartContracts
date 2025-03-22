// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Movly Gold Earn Token
 * @dev Token earned through physical activities in Movly ecosystem with fixed supply
 */
contract MGD is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 10000000000 * 10 ** 18; // 10 billion tokens

    event TokensBurned(address indexed from, uint256 amount);

    /**
     * @dev Constructor that mints all tokens at deployment and assigns them to deployer
     */
    constructor() ERC20("Movly Gold Earn", "MGD") Ownable() {
        // Mint all tokens to deployer
        _mint(msg.sender, MAX_SUPPLY);
    }

    /**
     * @dev Burns tokens from caller's address
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) public override {
        super.burn(amount);
        emit TokensBurned(msg.sender, amount);
    }

    /**
     * @dev Burns tokens from specified account
     * @param account Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address account, uint256 amount) public override {
        super.burnFrom(account, amount);
        emit TokensBurned(account, amount);
    }
}
