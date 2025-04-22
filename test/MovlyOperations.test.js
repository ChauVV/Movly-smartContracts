const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MovlyOperations", function () {
  let movlyToken;
  let movlyOperations;
  let owner;
  let systemWallet;
  let signer;
  let user;

  // Helper function to sign messages
  async function signWithdrawal(signer, userAddress, amount, nonce) {
    const messageHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "uint256"],
      [userAddress, amount, nonce]
    );
    
    // Sign the messageHash (EIP-191 format)
    const messageHashBinary = ethers.utils.arrayify(messageHash);
    return await signer.signMessage(messageHashBinary);
  }

  beforeEach(async function () {
    // Get signers
    [owner, systemWallet, signer, user] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory("MockERC20");
    movlyToken = await MockToken.deploy("Movly Token", "MOVLY", 18);
    await movlyToken.deployed();

    // Mint tokens to system wallet
    await movlyToken.mint(systemWallet.address, ethers.utils.parseEther("1000000"));

    // Deploy MovlyOperations contract
    const MovlyOperations = await ethers.getContractFactory("MovlyOperations");
    movlyOperations = await MovlyOperations.deploy(
      movlyToken.address,
      systemWallet.address,
      signer.address
    );
    await movlyOperations.deployed();

    // Mint some tokens to user for testing deposits
    await movlyToken.mint(user.address, ethers.utils.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("Should set the right token", async function () {
      expect(await movlyOperations.movlyToken()).to.equal(movlyToken.address);
    });

    it("Should set the right system wallet", async function () {
      expect(await movlyOperations.systemWallet()).to.equal(systemWallet.address);
    });

    it("Should set the right signer", async function () {
      expect(await movlyOperations.signerAddress()).to.equal(signer.address);
    });

    it("Should set the right owner", async function () {
      expect(await movlyOperations.owner()).to.equal(owner.address);
    });
  });

  describe("Deposit", function () {
    it("Should allow users to deposit tokens", async function () {
      const depositAmount = ethers.utils.parseEther("100");
      
      // Approve the contract to spend user's tokens
      await movlyToken.connect(user).approve(movlyOperations.address, depositAmount);
      
      // Deposit tokens
      await expect(movlyOperations.connect(user).deposit(depositAmount))
        .to.emit(movlyOperations, "Deposit")
        .withArgs(user.address, depositAmount);
      
      // Check system wallet balance increased
      expect(await movlyToken.balanceOf(systemWallet.address))
        .to.equal(ethers.utils.parseEther("1000100"));
    });

    it("Should revert if amount is zero", async function () {
      await expect(movlyOperations.connect(user).deposit(0))
        .to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("Withdraw", function () {
    beforeEach(async function () {
      // Approve the contract to spend system wallet's tokens
      await movlyToken.connect(systemWallet).approve(
        movlyOperations.address, 
        ethers.utils.parseEther("1000000")
      );
    });

    it("Should allow users to withdraw tokens with valid signature", async function () {
      const withdrawAmount = ethers.utils.parseEther("100");
      const nonce = 1;
      
      // Sign the withdrawal request
      const signature = await signWithdrawal(
        signer, 
        user.address, 
        withdrawAmount, 
        nonce
      );
      
      // Withdraw tokens
      await expect(movlyOperations.connect(user).withdraw(withdrawAmount, nonce, signature))
        .to.emit(movlyOperations, "Withdrawal")
        .withArgs(user.address, withdrawAmount, nonce);
      
      // Check user balance increased
      expect(await movlyToken.balanceOf(user.address))
        .to.equal(ethers.utils.parseEther("1100"));
      
      // Check system wallet balance decreased
      expect(await movlyToken.balanceOf(systemWallet.address))
        .to.equal(ethers.utils.parseEther("999900"));
    });

    it("Should revert if signature is invalid", async function () {
      const withdrawAmount = ethers.utils.parseEther("100");
      const nonce = 1;
      
      // Sign with wrong signer
      const signature = await signWithdrawal(
        owner, // Wrong signer
        user.address, 
        withdrawAmount, 
        nonce
      );
      
      await expect(movlyOperations.connect(user).withdraw(withdrawAmount, nonce, signature))
        .to.be.revertedWith("Invalid signature");
    });

    it("Should revert if nonce is reused", async function () {
      const withdrawAmount = ethers.utils.parseEther("100");
      const nonce = 1;
      
      // Sign the withdrawal request
      const signature = await signWithdrawal(
        signer, 
        user.address, 
        withdrawAmount, 
        nonce
      );
      
      // First withdrawal should succeed
      await movlyOperations.connect(user).withdraw(withdrawAmount, nonce, signature);
      
      // Second withdrawal with same nonce should fail
      await expect(movlyOperations.connect(user).withdraw(withdrawAmount, nonce, signature))
        .to.be.revertedWith("Nonce already used");
    });
  });

  describe("Admin functions", function () {
    it("Should allow owner to update system wallet", async function () {
      const newSystemWallet = user.address;
      
      await expect(movlyOperations.setSystemWallet(newSystemWallet))
        .to.emit(movlyOperations, "SystemWalletUpdated")
        .withArgs(systemWallet.address, newSystemWallet);
      
      expect(await movlyOperations.systemWallet()).to.equal(newSystemWallet);
    });

    it("Should allow owner to update signer", async function () {
      const newSigner = user.address;
      
      await expect(movlyOperations.setSigner(newSigner))
        .to.emit(movlyOperations, "SignerUpdated")
        .withArgs(signer.address, newSigner);
      
      expect(await movlyOperations.signerAddress()).to.equal(newSigner);
    });

    it("Should revert if non-owner tries to update system wallet", async function () {
      await expect(movlyOperations.connect(user).setSystemWallet(user.address))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should revert if non-owner tries to update signer", async function () {
      await expect(movlyOperations.connect(user).setSigner(user.address))
        .to.be.revertedWith("Ownable: caller is not the owner");
    });
  });
});
