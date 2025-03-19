// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "../token/HST.sol"; // Import HST contract
import "../token/HSE.sol"; // Import HSE contract

contract TokenDeployer is Ownable {
    HST public hst;
    HSE public hse;
    IERC20 public USDT;
    IERC20 public WETH;

    // Chainlink Price Feeds
    AggregatorV3Interface public bnbPriceFeed;
    AggregatorV3Interface public ethPriceFeed;

    enum SalePhase {
        Presale,
        PublicSale,
        Ended
    }
    SalePhase public currentPhase;

    // Sale timing
    uint256 public saleStartTime;
    uint256 public constant PRESALE_DURATION = 30 days;
    uint256 public constant PUBLIC_SALE_DURATION = 30 days;

    // Token amounts for sale
    uint256 public constant TOTAL_SALE_SUPPLY = 2000000000 * 10 ** 18; // 40% = 2B tokens
    uint256 public constant PRESALE_SUPPLY = 1400000000 * 10 ** 18; // 70% of sale = 1.4B
    uint256 public constant PUBLIC_SUPPLY = 600000000 * 10 ** 18; // 30% of sale = 600M

    // Thêm các constant này sau TOTAL_SALE_SUPPLY
    uint256 public constant HST_PER_USDT = 10; // 1 USDT = 10 HST
    uint256 public constant BONUS_PERCENT = 15; // 15% bonus cho presale

    // Sale tracking
    uint256 public presaleSold;
    uint256 public publicSaleSold;

    // Thêm các constant cho tokenomics
    uint256 public constant ECOSYSTEM_SUPPLY = 1500000000 * 10 ** 18; // 30% = 1.5B tokens
    uint256 public constant TEAM_SUPPLY = 750000000 * 10 ** 18; // 15% = 750M tokens
    uint256 public constant ADVISOR_SUPPLY = 150000000 * 10 ** 18; // 3% = 150M tokens
    uint256 public constant MARKETING_SUPPLY = 600000000 * 10 ** 18; // 12% = 600M tokens

    // Thêm các biến wallet address
    address public teamWallet;
    address public ecosystemWallet;
    address public advisorWallet;
    address public marketingWallet;

    // Thêm event cho việc set wallet
    event WalletUpdated(string walletType, address newAddress);

    // Events
    event PhaseChanged(SalePhase newPhase);
    event TokensPurchased(
        address buyer,
        uint256 amountIn,
        string tokenType,
        uint256 hstAmount
    );

    // Thêm struct cho Vesting
    struct VestingSchedule {
        uint256 totalAmount; // Tổng số token được vesting
        uint256 claimedAmount; // Số token đã claim
        uint256 startTime; // Thời điểm bắt đầu vesting
        uint256 cliffDuration; // Thời gian cliff (không thể claim)
        uint256 vestingDuration; // Tổng thời gian vesting
    }

    // Mapping cho vesting schedules - chỉ cho team và advisor
    mapping(address => VestingSchedule) public vestingSchedules;

    // Events cho vesting
    event TokensClaimed(address indexed wallet, uint256 amount);
    event VestingScheduleCreated(
        address indexed wallet,
        uint256 amount,
        uint256 startTime
    );

    // Constants cho vesting periods
    uint256 public constant CLIFF_DURATION = 180 days; // 6 tháng cliff
    uint256 public constant VESTING_DURATION = 720 days; // 24 tháng vesting

    constructor(
        address _bnbPriceFeed,
        address _ethPriceFeed,
        address _usdt,
        address _weth,
        // Thêm các wallet vào constructor
        address _teamWallet,
        address _advisorWallet,
        address _ecosystemWallet,
        address _marketingWallet
    ) {
        // Check các địa chỉ ví
        require(_teamWallet != address(0), "Invalid team wallet");
        require(_advisorWallet != address(0), "Invalid advisor wallet");
        require(_ecosystemWallet != address(0), "Invalid ecosystem wallet");
        require(_marketingWallet != address(0), "Invalid marketing wallet");

        // Deploy HST và HSE
        hst = new HST();
        hse = new HSE();

        // Verify total supply
        require(
            TOTAL_SALE_SUPPLY +
                ECOSYSTEM_SUPPLY +
                TEAM_SUPPLY +
                ADVISOR_SUPPLY +
                MARKETING_SUPPLY ==
                hst.totalSupply(),
            "Invalid total supply"
        );

        // Set addresses từ tham số
        bnbPriceFeed = AggregatorV3Interface(_bnbPriceFeed);
        ethPriceFeed = AggregatorV3Interface(_ethPriceFeed);
        USDT = IERC20(_usdt);
        WETH = IERC20(_weth);

        // Set các wallet
        teamWallet = _teamWallet;
        advisorWallet = _advisorWallet;
        ecosystemWallet = _ecosystemWallet;
        marketingWallet = _marketingWallet;

        // Emit events cho việc set wallet
        emit WalletUpdated("Team", _teamWallet);
        emit WalletUpdated("Advisor", _advisorWallet);
        emit WalletUpdated("Ecosystem", _ecosystemWallet);
        emit WalletUpdated("Marketing", _marketingWallet);

        currentPhase = SalePhase.Presale; // Bắt đầu với Presale ngay khi deploy

        // Setup vesting cho team và advisor (tokens vẫn giữ trong contract)
        _setupVesting(teamWallet, TEAM_SUPPLY);
        _setupVesting(advisorWallet, ADVISOR_SUPPLY);

        // Transfer ngay cho marketing và ecosystem
        require(
            hst.transfer(marketingWallet, MARKETING_SUPPLY),
            "Marketing transfer failed"
        );
        require(
            hst.transfer(ecosystemWallet, ECOSYSTEM_SUPPLY),
            "Ecosystem transfer failed"
        );
    }

    /**
     * @dev Get latest prices from Chainlink
     */
    function getBNBPrice() public view returns (uint256) {
        (, int256 price, , , ) = bnbPriceFeed.latestRoundData();
        return uint256(price);
    }

    function getETHPrice() public view returns (uint256) {
        (, int256 price, , , ) = ethPriceFeed.latestRoundData();
        return uint256(price);
    }

    /**
     * @dev Calculate HST amount based on USDT value
     */
    function calculateHSTAmount(uint256 usdtAmount) internal returns (uint256) {
        require(currentPhase != SalePhase.Ended, "Sale ended");

        uint256 hstAmount = usdtAmount * HST_PER_USDT;

        if (currentPhase == SalePhase.Presale) {
            hstAmount = hstAmount + ((hstAmount * BONUS_PERCENT) / 100);

            if (presaleSold + hstAmount > PRESALE_SUPPLY) {
                currentPhase = SalePhase.PublicSale;
                emit PhaseChanged(SalePhase.PublicSale);
                revert("Presale completed, please try again for public sale");
            }

            presaleSold += hstAmount;

            // Check if presale is completed after this purchase
            if (presaleSold >= PRESALE_SUPPLY) {
                currentPhase = SalePhase.PublicSale;
                emit PhaseChanged(SalePhase.PublicSale);
            }
        } else {
            // PublicSale
            if (publicSaleSold + hstAmount > PUBLIC_SUPPLY) {
                currentPhase = SalePhase.Ended;
                emit PhaseChanged(SalePhase.Ended);
                revert("Sale ended");
            }

            publicSaleSold += hstAmount;

            // Check if public sale is completed after this purchase
            if (publicSaleSold >= PUBLIC_SUPPLY) {
                currentPhase = SalePhase.Ended;
                emit PhaseChanged(SalePhase.Ended);
            }
        }

        return hstAmount;
    }

    /**
     * @dev Buy HST with BNB
     */
    function buyWithBNB() external payable {
        require(msg.value > 0, "Need to send BNB");
        uint256 bnbPrice = getBNBPrice();
        uint256 usdtValue = (msg.value * bnbPrice) / 1e8;
        uint256 hstAmount = calculateHSTAmount(usdtValue);
        require(hst.transfer(msg.sender, hstAmount), "HST transfer failed");
        emit TokensPurchased(msg.sender, msg.value, "BNB", hstAmount);
    }

    /**
     * @dev Buy HST with USDT
     */
    function buyWithUSDT(uint256 usdtAmount) external {
        require(usdtAmount > 0, "Need to send USDT");
        require(
            USDT.transferFrom(msg.sender, address(this), usdtAmount),
            "USDT transfer failed"
        );
        uint256 hstAmount = calculateHSTAmount(usdtAmount);
        require(hst.transfer(msg.sender, hstAmount), "HST transfer failed");
        emit TokensPurchased(msg.sender, usdtAmount, "USDT", hstAmount);
    }

    /**
     * @dev Buy HST with ETH
     */
    function buyWithETH() external payable {
        require(msg.value > 0, "Need to send ETH");
        uint256 ethPrice = getETHPrice();
        uint256 usdtValue = (msg.value * ethPrice) / 1e8; // Chainlink price có 8 decimals
        uint256 hstAmount = calculateHSTAmount(usdtValue);
        require(hst.transfer(msg.sender, hstAmount), "HST transfer failed");
        emit TokensPurchased(msg.sender, msg.value, "ETH", hstAmount);
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

    /**
     * @dev Withdraw functions
     */
    function withdrawUSDT() external onlyOwner {
        uint256 balance = USDT.balanceOf(address(this));
        require(USDT.transfer(owner(), balance), "USDT withdrawal failed");
    }

    function withdrawBNB() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = owner().call{value: balance}("");
        require(success, "BNB withdrawal failed");
    }

    // Thêm function để check balance của các ví
    function getWalletBalances()
        external
        view
        returns (
            uint256 teamBalance,
            uint256 ecosystemBalance,
            uint256 advisorBalance,
            uint256 marketingBalance
        )
    {
        return (
            hst.balanceOf(teamWallet),
            hst.balanceOf(ecosystemWallet),
            hst.balanceOf(advisorWallet),
            hst.balanceOf(marketingWallet)
        );
    }

    receive() external payable {}

    /**
     * @dev Setup vesting schedule cho một ví
     */
    function _setupVesting(address wallet, uint256 amount) internal {
        require(wallet != address(0), "Invalid wallet");
        require(
            vestingSchedules[wallet].totalAmount == 0,
            "Vesting already setup"
        );

        vestingSchedules[wallet] = VestingSchedule({
            totalAmount: amount,
            claimedAmount: 0,
            startTime: block.timestamp,
            cliffDuration: CLIFF_DURATION,
            vestingDuration: VESTING_DURATION
        });

        emit VestingScheduleCreated(wallet, amount, block.timestamp);
    }

    /**
     * @dev Tính số token có thể claim tại thời điểm hiện tại
     */
    function getClaimableAmount(address wallet) public view returns (uint256) {
        VestingSchedule memory schedule = vestingSchedules[wallet];

        if (schedule.totalAmount == 0) return 0;
        if (block.timestamp < schedule.startTime + schedule.cliffDuration)
            return 0;
        if (block.timestamp >= schedule.startTime + schedule.vestingDuration) {
            return schedule.totalAmount - schedule.claimedAmount;
        }

        uint256 timeFromStart = block.timestamp - schedule.startTime;
        uint256 vestedAmount = (schedule.totalAmount * timeFromStart) /
            schedule.vestingDuration;
        return vestedAmount - schedule.claimedAmount;
    }

    /**
     * @dev Claim vested tokens
     */
    function claimVestedTokens() external {
        require(
            msg.sender == teamWallet || msg.sender == advisorWallet,
            "Not a vesting wallet"
        );

        uint256 claimable = getClaimableAmount(msg.sender);
        require(claimable > 0, "No tokens claimable");

        vestingSchedules[msg.sender].claimedAmount += claimable;
        require(hst.transfer(msg.sender, claimable), "Token transfer failed");

        emit TokensClaimed(msg.sender, claimable);
    }

    /**
     * @dev Get vesting info - chỉ trả về thông tin nếu là team hoặc advisor wallet
     */
    function getVestingInfo(
        address wallet
    )
        external
        view
        returns (
            uint256 totalAmount,
            uint256 claimedAmount,
            uint256 claimableAmount,
            uint256 startTime,
            uint256 nextClaimTime,
            uint256 vestingEndTime
        )
    {
        require(
            wallet == teamWallet || wallet == advisorWallet,
            "No vesting schedule for this wallet"
        );

        VestingSchedule memory schedule = vestingSchedules[wallet];
        return (
            schedule.totalAmount,
            schedule.claimedAmount,
            getClaimableAmount(wallet),
            schedule.startTime,
            schedule.startTime + schedule.cliffDuration,
            schedule.startTime + schedule.vestingDuration
        );
    }
}
