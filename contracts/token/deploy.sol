// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "./Movly.sol"; // Import Movly contract
import "./MGD.sol"; // Import MGD contract

contract TokenDeployer is Ownable {
    Movly public movly;
    MGD public mgd;
    IERC20 public USDT;

    // Chainlink Price Feeds
    AggregatorV3Interface public bnbPriceFeed;

    // Backup price mechanism for price feed failures
    uint256 public fallbackBnbPrice; // 8 decimals (same as chainlink)
    uint256 public lastPriceUpdateTimestamp;
    uint256 public constant MAX_PRICE_AGE = 1 days; // Maximum age of the price feed data

    enum SalePhase {
        Presale,
        PublicSale,
        Ended
    }
    SalePhase public currentPhase;

    // Token amounts for sale
    uint256 public constant TOTAL_SALE_SUPPLY = 2000000000 * 10 ** 18; // 40% = 2B tokens
    uint256 public constant PRESALE_SUPPLY = 1400000000 * 10 ** 18; // 70% of sale = 1.4B (including 15% bonus)
    uint256 public constant PUBLIC_SUPPLY = 600000000 * 10 ** 18; // 30% of sale = 600M

    // Token conversion rates
    uint256 public constant MOVLY_PER_USDT = 25; // 1 USDT = 25 Movly
    uint256 public constant BONUS_PERCENT = 15; // 15% bonus for presale

    // Sale tracking
    uint256 public presaleSold; // Tokens sold in presale (including bonus)
    uint256 public publicSaleSold;

    // Constants for tokenomics
    uint256 public constant ECOSYSTEM_SUPPLY = 1500000000 * 10 ** 18; // 30% = 1.5B tokens
    uint256 public constant TEAM_SUPPLY = 750000000 * 10 ** 18; // 15% = 750M tokens
    uint256 public constant ADVISOR_SUPPLY = 150000000 * 10 ** 18; // 3% = 150M tokens
    uint256 public constant MARKETING_SUPPLY = 600000000 * 10 ** 18; // 12% = 600M tokens

    // Wallet addresses
    address public teamWallet;
    address public ecosystemWallet;
    address public advisorWallet;
    address public marketingWallet;

    // Events
    event PhaseChanged(SalePhase newPhase);
    event TokensPurchased(
        address buyer,
        uint256 amountIn,
        string tokenType,
        uint256 movlyAmount,
        uint256 bonusAmount
    );
    event FundsSentToOwner(
        address ownerAddress,
        uint256 amount,
        string tokenType
    );
    event WalletUpdated(string walletType, address newAddress);
    event UnsoldTokensWithdrawn(uint256 amount);
    event PriceFeedUpdated(address newPriceFeed);
    event FallbackPriceUpdated(uint256 newPrice);
    event UsedFallbackPrice(uint256 fallbackPrice);

    // Vesting constants
    uint256 public constant VESTING_MONTHS = 24; // 24 months vesting
    uint256 public constant MONTH_IN_SECONDS = 30 days;

    // Vesting Structure
    struct VestingSchedule {
        uint256 totalAmount; // Total amount of tokens being vested
        uint256 monthlyAmount; // Monthly token release amount
        uint256 claimedAmount; // Amount already claimed
        uint256 startTime; // Vesting start time
        uint256 lastClaimTime; // Last claim timestamp
        uint256 monthsClaimed; // Number of months claimed
        uint256 remainderAmount; // Remainder tokens to be added in the last month
    }

    // Mapping for vesting schedules - only for team and advisor
    mapping(address => VestingSchedule) public vestingSchedules;

    // Vesting events
    event TokensClaimed(address indexed wallet, uint256 amount);
    event VestingScheduleCreated(
        address indexed wallet,
        uint256 totalAmount,
        uint256 monthlyAmount,
        uint256 startTime
    );

    constructor(
        address _bnbPriceFeed,
        address _usdt,
        address _teamWallet,
        address _advisorWallet,
        address _ecosystemWallet,
        address _marketingWallet
    ) {
        // Check required addresses
        require(_bnbPriceFeed != address(0), "Invalid BNB price feed address");
        require(_usdt != address(0), "Invalid USDT address");

        // Check wallet addresses
        require(_teamWallet != address(0), "Invalid team wallet");
        require(_advisorWallet != address(0), "Invalid advisor wallet");
        require(_ecosystemWallet != address(0), "Invalid ecosystem wallet");
        require(_marketingWallet != address(0), "Invalid marketing wallet");

        // Deploy Movly and MGD
        movly = new Movly();
        mgd = new MGD();

        // Verify total supply
        require(
            TOTAL_SALE_SUPPLY +
                ECOSYSTEM_SUPPLY +
                TEAM_SUPPLY +
                ADVISOR_SUPPLY +
                MARKETING_SUPPLY ==
                movly.MAX_SUPPLY(),
            "Invalid total supply"
        );

        // Set addresses from parameters
        bnbPriceFeed = AggregatorV3Interface(_bnbPriceFeed);
        USDT = IERC20(_usdt);

        // Initialize fallback price using the current price from Chainlink
        // This requires the price feed to be working at deployment time
        try bnbPriceFeed.latestRoundData() returns (
            uint80,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            require(price > 0, "Initial price feed must be positive");
            fallbackBnbPrice = uint256(price);
            lastPriceUpdateTimestamp = updatedAt;
        } catch {
            // If Chainlink is not available at deployment, we need a reasonable initial value
            fallbackBnbPrice = 60000000000; // $600 with 8 decimals as a safe default
            lastPriceUpdateTimestamp = block.timestamp;
        }

        // Set wallets
        teamWallet = _teamWallet;
        advisorWallet = _advisorWallet;
        ecosystemWallet = _ecosystemWallet;
        marketingWallet = _marketingWallet;

        // Emit events for wallet setup
        emit WalletUpdated("Team", _teamWallet);
        emit WalletUpdated("Advisor", _advisorWallet);
        emit WalletUpdated("Ecosystem", _ecosystemWallet);
        emit WalletUpdated("Marketing", _marketingWallet);

        // Start with Presale immediately on deployment
        currentPhase = SalePhase.Presale;

        // Setup vesting for team and advisor (tokens remain in contract)
        _setupVesting(teamWallet, TEAM_SUPPLY);
        _setupVesting(advisorWallet, ADVISOR_SUPPLY);

        // Transfer immediately to marketing and ecosystem
        require(
            movly.transfer(marketingWallet, MARKETING_SUPPLY),
            "Marketing transfer failed"
        );
        require(
            movly.transfer(ecosystemWallet, ECOSYSTEM_SUPPLY),
            "Ecosystem transfer failed"
        );
    }

    /**
     * @dev Allow owner to update the Chainlink price feed address
     */
    function updatePriceFeed(address newPriceFeed) external onlyOwner {
        require(newPriceFeed != address(0), "Invalid price feed address");
        bnbPriceFeed = AggregatorV3Interface(newPriceFeed);
        emit PriceFeedUpdated(newPriceFeed);

        // Update fallback price immediately
        updateFallbackPrice();
    }

    /**
     * @dev Allow owner to update the fallback price manually
     */
    function setFallbackPrice(uint256 newPrice) external onlyOwner {
        require(newPrice > 0, "Price must be positive");
        fallbackBnbPrice = newPrice;
        lastPriceUpdateTimestamp = block.timestamp;
        emit FallbackPriceUpdated(newPrice);
    }

    /**
     * @dev Update the fallback price from Chainlink
     * Can be called by anyone to ensure the fallback price is current
     */
    function updateFallbackPrice() public {
        try bnbPriceFeed.latestRoundData() returns (
            uint80,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (price > 0 && updatedAt > lastPriceUpdateTimestamp) {
                fallbackBnbPrice = uint256(price);
                lastPriceUpdateTimestamp = updatedAt;
                emit FallbackPriceUpdated(uint256(price));
            }
        } catch {
            // If the call fails, keep using the existing fallback price
            // No need to do anything here
        }
    }

    /**
     * @dev Allow owner to end presale and start public sale
     */
    function endPresale() external onlyOwner {
        require(currentPhase == SalePhase.Presale, "Not in presale phase");
        currentPhase = SalePhase.PublicSale;
        emit PhaseChanged(SalePhase.PublicSale);
    }

    /**
     * @dev Allow owner to end public sale
     */
    function endPublicSale() external onlyOwner {
        require(
            currentPhase == SalePhase.PublicSale,
            "Not in public sale phase"
        );
        currentPhase = SalePhase.Ended;
        emit PhaseChanged(SalePhase.Ended);
    }

    /**
     * @dev Allow owner to end the entire sale
     */
    function endSale() external onlyOwner {
        require(currentPhase != SalePhase.Ended, "Sale already ended");
        currentPhase = SalePhase.Ended;
        emit PhaseChanged(SalePhase.Ended);
    }

    /**
     * @dev Allow owner to withdraw unsold tokens after sale ends
     */
    function withdrawUnsoldTokens() external onlyOwner {
        require(currentPhase == SalePhase.Ended, "Sale not ended yet");

        uint256 unsoldAmount = PRESALE_SUPPLY +
            PUBLIC_SUPPLY -
            presaleSold -
            publicSaleSold;
        require(unsoldAmount > 0, "No unsold tokens to withdraw");

        require(movly.transfer(owner(), unsoldAmount), "Token transfer failed");
        emit UnsoldTokensWithdrawn(unsoldAmount);
    }

    /**
     * @dev Get latest BNB price from Chainlink with fallback mechanism
     * Will try to use Chainlink first, and fallback to the stored price if it fails
     */
    function getBNBPrice() public returns (uint256) {
        bool usedFallbackPrice = false;
        uint256 bnbPrice;

        // Try to get price from Chainlink
        try bnbPriceFeed.latestRoundData() returns (
            uint80,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            // Check if price is valid and not stale
            if (price > 0 && block.timestamp - updatedAt <= MAX_PRICE_AGE) {
                bnbPrice = uint256(price);

                // Update fallback price for future use
                if (updatedAt > lastPriceUpdateTimestamp) {
                    fallbackBnbPrice = uint256(price);
                    lastPriceUpdateTimestamp = updatedAt;
                }
            } else {
                // Price is negative, zero, or stale - use fallback
                bnbPrice = fallbackBnbPrice;
                usedFallbackPrice = true;
            }
        } catch {
            // If Chainlink call fails, use fallback price
            bnbPrice = fallbackBnbPrice;
            usedFallbackPrice = true;
        }

        if (usedFallbackPrice) {
            emit UsedFallbackPrice(bnbPrice);
        }

        return bnbPrice;
    }

    /**
     * @dev View function version of getBNBPrice (doesn't modify state)
     */
    function getBNBPriceView() public view returns (uint256) {
        // Try to get price from Chainlink
        try bnbPriceFeed.latestRoundData() returns (
            uint80,
            int256 price,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            // Check if price is valid and not stale
            if (price > 0 && block.timestamp - updatedAt <= MAX_PRICE_AGE) {
                return uint256(price);
            }
        } catch {
            // Ignore errors
        }

        // Use fallback price if Chainlink fails or returns invalid data
        return fallbackBnbPrice;
    }

    /**
     * @dev Calculate Movly amount based on USDT value
     * @return baseAmount Base token amount (excluding bonus)
     * @return bonusAmount Bonus token amount (if applicable)
     * @return totalAmount Total token amount (including bonus)
     */
    function calculateMovlyAmount(
        uint256 usdtAmount
    )
        internal
        view
        returns (uint256 baseAmount, uint256 bonusAmount, uint256 totalAmount)
    {
        require(currentPhase != SalePhase.Ended, "Sale ended");

        baseAmount = usdtAmount * MOVLY_PER_USDT;
        bonusAmount = 0;
        totalAmount = baseAmount;

        if (currentPhase == SalePhase.Presale) {
            bonusAmount = (baseAmount * BONUS_PERCENT) / 100;
            totalAmount = baseAmount + bonusAmount;
        }

        return (baseAmount, bonusAmount, totalAmount);
    }

    /**
     * @dev Buy Movly with BNB
     */
    function buyWithBNB() external payable {
        require(currentPhase != SalePhase.Ended, "Sale ended");
        require(msg.value > 0, "Need to send BNB");

        // Calculate Movly tokens to sell
        uint256 bnbPrice = getBNBPrice();
        uint256 usdtValue = (msg.value * bnbPrice) / 1e8;
        (
            ,
            // Unused baseAmount
            uint256 bonusAmount,
            uint256 totalAmount
        ) = calculateMovlyAmount(usdtValue);

        // Check if presale exceeds supply
        if (currentPhase == SalePhase.Presale) {
            if (presaleSold + totalAmount > PRESALE_SUPPLY) {
                currentPhase = SalePhase.PublicSale;
                emit PhaseChanged(SalePhase.PublicSale);
                revert("Presale completed, please try again for public sale");
            }
            presaleSold += totalAmount;

            // Check if presale is sold out
            if (presaleSold >= PRESALE_SUPPLY) {
                currentPhase = SalePhase.PublicSale;
                emit PhaseChanged(SalePhase.PublicSale);
            }
        } else {
            // Public sale
            if (publicSaleSold + totalAmount > PUBLIC_SUPPLY) {
                currentPhase = SalePhase.Ended;
                emit PhaseChanged(SalePhase.Ended);
                revert("Sale ended");
            }
            publicSaleSold += totalAmount;

            // Check if public sale is sold out
            if (publicSaleSold >= PUBLIC_SUPPLY) {
                currentPhase = SalePhase.Ended;
                emit PhaseChanged(SalePhase.Ended);
            }
        }

        // Transfer Movly tokens to buyer
        require(
            movly.transfer(msg.sender, totalAmount),
            "Movly transfer failed"
        );

        // Transfer BNB directly to owner's wallet
        (bool success, ) = owner().call{value: msg.value}("");
        require(success, "BNB transfer to owner failed");

        // Emit events
        emit TokensPurchased(
            msg.sender,
            msg.value,
            "BNB",
            totalAmount,
            bonusAmount
        );
        emit FundsSentToOwner(owner(), msg.value, "BNB");
    }

    /**
     * @dev Buy Movly with USDT
     */
    function buyWithUSDT(uint256 usdtAmount) external {
        require(currentPhase != SalePhase.Ended, "Sale ended");
        require(usdtAmount > 0, "Need to send USDT");

        // Calculate Movly tokens to sell
        (
            ,
            // Unused baseAmount
            uint256 bonusAmount,
            uint256 totalAmount
        ) = calculateMovlyAmount(usdtAmount);

        // Check if presale exceeds supply
        if (currentPhase == SalePhase.Presale) {
            if (presaleSold + totalAmount > PRESALE_SUPPLY) {
                currentPhase = SalePhase.PublicSale;
                emit PhaseChanged(SalePhase.PublicSale);
                revert("Presale completed, please try again for public sale");
            }
            presaleSold += totalAmount;

            // Check if presale is sold out
            if (presaleSold >= PRESALE_SUPPLY) {
                currentPhase = SalePhase.PublicSale;
                emit PhaseChanged(SalePhase.PublicSale);
            }
        } else {
            // Public sale
            if (publicSaleSold + totalAmount > PUBLIC_SUPPLY) {
                currentPhase = SalePhase.Ended;
                emit PhaseChanged(SalePhase.Ended);
                revert("Sale ended");
            }
            publicSaleSold += totalAmount;

            // Check if public sale is sold out
            if (publicSaleSold >= PUBLIC_SUPPLY) {
                currentPhase = SalePhase.Ended;
                emit PhaseChanged(SalePhase.Ended);
            }
        }

        // Transfer USDT directly from sender to owner
        require(
            USDT.transferFrom(msg.sender, owner(), usdtAmount),
            "USDT transfer to owner failed"
        );

        // Transfer Movly tokens to buyer
        require(
            movly.transfer(msg.sender, totalAmount),
            "Movly transfer failed"
        );

        // Emit events
        emit TokensPurchased(
            msg.sender,
            usdtAmount,
            "USDT",
            totalAmount,
            bonusAmount
        );
        emit FundsSentToOwner(owner(), usdtAmount, "USDT");
    }

    /**
     * @dev Get current sale status
     */
    function getSaleStatus()
        external
        view
        returns (
            SalePhase phase,
            uint256 presaleSoldAmount,
            uint256 presaleRemaining,
            uint256 publicSaleSoldAmount,
            uint256 publicSaleRemaining,
            uint256 currentBonus
        )
    {
        return (
            currentPhase,
            presaleSold,
            PRESALE_SUPPLY - presaleSold,
            publicSaleSold,
            PUBLIC_SUPPLY - publicSaleSold,
            currentPhase == SalePhase.Presale ? BONUS_PERCENT : 0
        );
    }

    receive() external payable {
        // Transfer BNB directly to owner's wallet when contract receives BNB
        if (msg.value > 0) {
            (bool success, ) = owner().call{value: msg.value}("");
            require(success, "BNB transfer to owner failed");
            emit FundsSentToOwner(owner(), msg.value, "BNB");
        }
    }

    /**
     * @dev Setup vesting schedule for a wallet - distributed evenly over 24 months
     * Any remainder tokens from division will be added to the last month
     */
    function _setupVesting(address wallet, uint256 amount) internal {
        require(wallet != address(0), "Invalid wallet");
        require(
            vestingSchedules[wallet].totalAmount == 0,
            "Vesting already setup"
        );

        uint256 monthlyAmount = amount / VESTING_MONTHS;
        uint256 remainder = amount % VESTING_MONTHS; // Calculate remainder tokens

        vestingSchedules[wallet] = VestingSchedule({
            totalAmount: amount,
            monthlyAmount: monthlyAmount,
            claimedAmount: 0,
            startTime: block.timestamp,
            lastClaimTime: block.timestamp,
            monthsClaimed: 0,
            remainderAmount: remainder
        });

        emit VestingScheduleCreated(
            wallet,
            amount,
            monthlyAmount,
            block.timestamp
        );
    }

    /**
     * @dev Calculate claimable token amount at current time
     * Returns tokens for months elapsed since last claim
     * Handles remainder tokens in the last month
     */
    function getClaimableAmount(address wallet) public view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[wallet];

        if (schedule.totalAmount == 0) return 0;
        if (schedule.monthsClaimed >= VESTING_MONTHS) return 0;

        // Calculate months elapsed since last claim
        uint256 timeElapsed = block.timestamp - schedule.lastClaimTime;
        uint256 monthsElapsed = timeElapsed / MONTH_IN_SECONDS;

        // Ensure remaining months are sufficient for claiming
        uint256 remainingMonths = VESTING_MONTHS - schedule.monthsClaimed;
        uint256 claimableMonths = monthsElapsed > remainingMonths
            ? remainingMonths
            : monthsElapsed;

        // Calculate basic claimable amount
        uint256 claimableAmount = claimableMonths * schedule.monthlyAmount;

        // Add remainder tokens if this is the final claim (last month)
        if (schedule.monthsClaimed + claimableMonths == VESTING_MONTHS) {
            claimableAmount += schedule.remainderAmount;
        }

        return claimableAmount;
    }

    /**
     * @dev Claim vested tokens monthly
     */
    function claimVestedTokens() external {
        require(
            msg.sender == teamWallet || msg.sender == advisorWallet,
            "Not a vesting wallet"
        );

        uint256 claimable = getClaimableAmount(msg.sender);
        require(claimable > 0, "No tokens claimable");

        VestingSchedule storage schedule = vestingSchedules[msg.sender];

        // Calculate months elapsed since last claim
        uint256 timeElapsed = block.timestamp - schedule.lastClaimTime;
        uint256 monthsElapsed = timeElapsed / MONTH_IN_SECONDS;

        // Ensure not exceeding total months
        uint256 remainingMonths = VESTING_MONTHS - schedule.monthsClaimed;
        uint256 claimableMonths = monthsElapsed > remainingMonths
            ? remainingMonths
            : monthsElapsed;

        // Update vesting information
        schedule.claimedAmount += claimable;
        schedule.monthsClaimed += claimableMonths;
        schedule.lastClaimTime += claimableMonths * MONTH_IN_SECONDS;

        // Ensure we don't exceed total amount due to rounding
        if (schedule.claimedAmount > schedule.totalAmount) {
            schedule.claimedAmount = schedule.totalAmount;
        }

        // Transfer tokens
        require(movly.transfer(msg.sender, claimable), "Token transfer failed");

        emit TokensClaimed(msg.sender, claimable);
    }

    /**
     * @dev Get vesting info - only returns information for team or advisor wallet
     */
    function getVestingInfo(
        address wallet
    )
        external
        view
        returns (
            uint256 totalAmount,
            uint256 monthlyAmount,
            uint256 claimedAmount,
            uint256 claimableAmount,
            uint256 monthsClaimed,
            uint256 remainingMonths
        )
    {
        require(
            wallet == teamWallet || wallet == advisorWallet,
            "No vesting schedule for this wallet"
        );

        VestingSchedule memory schedule = vestingSchedules[wallet];

        return (
            schedule.totalAmount,
            schedule.monthlyAmount,
            schedule.claimedAmount,
            getClaimableAmount(wallet),
            schedule.monthsClaimed,
            VESTING_MONTHS - schedule.monthsClaimed
        );
    }
}
