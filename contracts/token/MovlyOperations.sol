// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title MovlyOperations
 * @dev Contract for handling Movly token operations including user-paid gas withdrawals
 */
contract MovlyOperations is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    // Token contract
    IERC20 public movlyToken;
    
    // System wallet that holds tokens for users
    address public systemWallet;
    
    // Backend signer address for validating withdrawal requests
    address public signerAddress;
    
    // Nonce tracking to prevent replay attacks
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    
    // Events
    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount, uint256 nonce);
    event SystemWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    
    /**
     * @dev Constructor
     * @param _token Address of the Movly token contract
     * @param _systemWallet Address of the system wallet that holds tokens
     * @param _signer Address of the backend signer for validating withdrawals
     */
    constructor(address _token, address _systemWallet, address _signer) {
        require(_token != address(0), "Invalid token address");
        require(_systemWallet != address(0), "Invalid system wallet address");
        require(_signer != address(0), "Invalid signer address");
        
        movlyToken = IERC20(_token);
        systemWallet = _systemWallet;
        signerAddress = _signer;
    }
    
    /**
     * @dev Deposit tokens from user to system
     * @param amount Amount of tokens to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        // Transfer tokens from user to system wallet
        // User must approve this contract first
        bool success = movlyToken.transferFrom(msg.sender, systemWallet, amount);
        require(success, "Token transfer failed");
        
        emit Deposit(msg.sender, amount);
    }
    
    /**
     * @dev Withdraw tokens from system to user with user paying gas
     * @param amount Amount of tokens to withdraw
     * @param nonce Unique nonce to prevent replay attacks
     * @param signature Signature from backend authorizing the withdrawal
     */
    function withdraw(uint256 amount, uint256 nonce, bytes memory signature) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(!usedNonces[msg.sender][nonce], "Nonce already used");
        
        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, amount, nonce));
        bytes32 signedHash = messageHash.toEthSignedMessageHash();
        address recoveredSigner = signedHash.recover(signature);
        
        require(recoveredSigner == signerAddress, "Invalid signature");
        
        // Mark nonce as used
        usedNonces[msg.sender][nonce] = true;
        
        // Transfer tokens from system wallet to user
        // System wallet must approve this contract first
        bool success = movlyToken.transferFrom(systemWallet, msg.sender, amount);
        require(success, "Token transfer failed");
        
        emit Withdrawal(msg.sender, amount, nonce);
    }
    
    /**
     * @dev Update system wallet address
     * @param _newWallet New system wallet address
     */
    function setSystemWallet(address _newWallet) external onlyOwner {
        require(_newWallet != address(0), "Invalid wallet address");
        address oldWallet = systemWallet;
        systemWallet = _newWallet;
        emit SystemWalletUpdated(oldWallet, _newWallet);
    }
    
    /**
     * @dev Update signer address
     * @param _newSigner New signer address
     */
    function setSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid signer address");
        address oldSigner = signerAddress;
        signerAddress = _newSigner;
        emit SignerUpdated(oldSigner, _newSigner);
    }
    
    /**
     * @dev Check if a nonce has been used
     * @param user User address
     * @param nonce Nonce to check
     * @return bool True if nonce has been used
     */
    function isNonceUsed(address user, uint256 nonce) external view returns (bool) {
        return usedNonces[user][nonce];
    }
}
