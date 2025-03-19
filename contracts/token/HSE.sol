// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * Health Step Earn Token
 * @dev Token earned through physical activities in HealthStep ecosystem
 */
contract HSE is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 3000000000 * 10 ** 18; // 3 billion tokens
    uint256 public totalMinted;

    event TokensMinted(address indexed to, uint256 amount);

    constructor() ERC20("Health Step Earn", "HSE") {}

    function mint(address to, uint256 amount) public onlyOwner {
        require(totalMinted + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
        totalMinted += amount;
        emit TokensMinted(to, amount);
    }

    /**
     * @dev Returns remaining tokens that can be minted
     */
    function remainingSupply() public view returns (uint256) {
        return MAX_SUPPLY - totalMinted;
    }
}
