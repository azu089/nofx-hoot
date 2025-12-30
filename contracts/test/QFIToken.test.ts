import { expect } from "chai";
import { ethers } from "hardhat";
import { QFIToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("QFIToken", function () {
  let token: QFIToken;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.parseEther("10000000"); // 1000 万
  const MAX_SUPPLY = ethers.parseEther("100000000"); // 1 亿

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const QFIToken = await ethers.getContractFactory("QFIToken");
    token = await QFIToken.deploy(owner.address);
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await token.name()).to.equal("QuantFi Token");
      expect(await token.symbol()).to.equal("QFI");
    });

    it("Should mint initial supply to owner", async function () {
      expect(await token.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("Should set the right owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should have correct max supply", async function () {
      expect(await token.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint", async function () {
      const mintAmount = ethers.parseEther("1000");
      await token.mint(addr1.address, mintAmount);
      expect(await token.balanceOf(addr1.address)).to.equal(mintAmount);
    });

    it("Should not allow non-owner to mint", async function () {
      const mintAmount = ethers.parseEther("1000");
      await expect(
        token.connect(addr1).mint(addr1.address, mintAmount)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should not exceed max supply", async function () {
      const excessAmount = MAX_SUPPLY;
      await expect(token.mint(addr1.address, excessAmount)).to.be.revertedWith(
        "Exceeds max supply"
      );
    });
  });

  describe("Burning", function () {
    it("Should allow burning tokens", async function () {
      const burnAmount = ethers.parseEther("1000");
      await token.burn(burnAmount);
      expect(await token.totalBurned()).to.equal(burnAmount);
    });

    it("Should update total burned", async function () {
      const burnAmount = ethers.parseEther("1000");
      await token.burn(burnAmount);
      await token.burn(burnAmount);
      expect(await token.totalBurned()).to.equal(burnAmount * 2n);
    });
  });

  describe("Pause", function () {
    it("Should allow owner to pause", async function () {
      await token.pause();
      expect(await token.paused()).to.be.true;
    });

    it("Should block transfers when paused", async function () {
      await token.pause();
      await expect(
        token.transfer(addr1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("Should allow transfers when unpaused", async function () {
      await token.pause();
      await token.unpause();
      await token.transfer(addr1.address, ethers.parseEther("100"));
      expect(await token.balanceOf(addr1.address)).to.equal(
        ethers.parseEther("100")
      );
    });
  });

  describe("Buyback Wallet", function () {
    it("Should allow owner to set buyback wallet", async function () {
      await token.setBuybackWallet(addr1.address);
      expect(await token.buybackWallet()).to.equal(addr1.address);
    });

    it("Should not allow zero address", async function () {
      await expect(
        token.setBuybackWallet(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });
  });
});
