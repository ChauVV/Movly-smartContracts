// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockPriceFeed {
    int256 private price;
    uint8 private decimals = 8;
    address public admin;

    constructor(int256 _initialPrice) {
        price = _initialPrice;
        admin = msg.sender;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            0, // roundId
            price, // answer (price)
            block.timestamp, // startedAt
            block.timestamp, // updatedAt
            0 // answeredInRound
        );
    }

    // Function to update price - only admin can call
    function setPrice(int256 _price) external {
        require(msg.sender == admin, "Only admin can update price");
        price = _price;
    }

    function getDecimals() external view returns (uint8) {
        return decimals;
    }
}
