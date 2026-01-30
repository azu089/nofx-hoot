import { expect } from "chai";
import { ethers } from "hardhat";
import { HOOTToken } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("HOOTToken", function () {
  let hootToken: HOOTToken;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.parseEther("10000000"); // 1000万
  const MAX_SUPPLY = ethers.parseEther("100000000"); // 1亿

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    const HOOTToken = await ethers.getContractFactory("HOOTToken");
    hootToken = await HOOTToken.deploy(owner.address);
  });

  describe("部署", function () {
    it("应该设置正确的名称和符号", async function () {
      expect(await hootToken.name()).to.equal("HOOT Token");
      expect(await hootToken.symbol()).to.equal("HOOT");
    });

    it("应该铸造初始供应量给 owner", async function () {
      expect(await hootToken.balanceOf(owner.address)).to.equal(INITIAL_SUPPLY);
    });

    it("应该设置正确的最大供应量", async function () {
      expect(await hootToken.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
    });

    it("应该设置正确的 owner", async function () {
      expect(await hootToken.owner()).to.equal(owner.address);
    });
  });

  describe("铸造", function () {
    it("owner 应该能够铸造代币", async function () {
      const mintAmount = ethers.parseEther("1000000");
      await hootToken.mint(user1.address, mintAmount);
      expect(await hootToken.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("非 owner 不能铸造代币", async function () {
      const mintAmount = ethers.parseEther("1000");
      await expect(
        hootToken.connect(user1).mint(user1.address, mintAmount)
      ).to.be.revertedWithCustomError(hootToken, "OwnableUnauthorizedAccount");
    });

    it("不能超过最大供应量", async function () {
      const overMaxAmount = MAX_SUPPLY; // 当前已有 1000 万
      await expect(
        hootToken.mint(user1.address, overMaxAmount)
      ).to.be.revertedWith("Exceeds max supply");
    });

    it("应该发出 Minted 事件", async function () {
      const mintAmount = ethers.parseEther("1000");
      await expect(hootToken.mint(user1.address, mintAmount))
        .to.emit(hootToken, "Minted")
        .withArgs(user1.address, mintAmount);
    });
  });

  describe("销毁", function () {
    it("用户应该能够销毁自己的代币", async function () {
      // 先转一些代币给 user1
      await hootToken.transfer(user1.address, ethers.parseEther("1000"));

      // user1 销毁
      const burnAmount = ethers.parseEther("500");
      await hootToken.connect(user1).burn(burnAmount);

      expect(await hootToken.balanceOf(user1.address)).to.equal(
        ethers.parseEther("500")
      );
      expect(await hootToken.totalBurned()).to.equal(burnAmount);
    });

    it("销毁应该发出 TokensBurned 事件", async function () {
      const burnAmount = ethers.parseEther("1000");
      await expect(hootToken.burn(burnAmount))
        .to.emit(hootToken, "TokensBurned")
        .withArgs(owner.address, burnAmount, burnAmount);
    });
  });

  describe("暂停", function () {
    it("owner 应该能够暂停合约", async function () {
      await hootToken.pause();
      expect(await hootToken.paused()).to.equal(true);
    });

    it("暂停后不能转账", async function () {
      await hootToken.pause();
      await expect(
        hootToken.transfer(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(hootToken, "EnforcedPause");
    });

    it("恢复后可以转账", async function () {
      await hootToken.pause();
      await hootToken.unpause();
      await hootToken.transfer(user1.address, ethers.parseEther("100"));
      expect(await hootToken.balanceOf(user1.address)).to.equal(
        ethers.parseEther("100")
      );
    });
  });

  describe("回购钱包", function () {
    it("owner 应该能够设置回购钱包", async function () {
      await hootToken.setBuybackWallet(user1.address);
      expect(await hootToken.buybackWallet()).to.equal(user1.address);
    });

    it("不能设置零地址", async function () {
      await expect(
        hootToken.setBuybackWallet(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid address");
    });

    it("回购钱包可以记录回购销毁", async function () {
      await hootToken.setBuybackWallet(user1.address);

      await expect(
        hootToken
          .connect(user1)
          .recordBuybackBurn(
            ethers.parseEther("1000"),
            ethers.parseEther("10000"),
            ethers.parseEther("0.1")
          )
      )
        .to.emit(hootToken, "BuybackBurned")
        .withArgs(
          ethers.parseEther("1000"),
          ethers.parseEther("10000"),
          ethers.parseEther("0.1")
        );
    });
  });

  describe("查询函数", function () {
    it("circulatingSupply 应该返回正确的流通量", async function () {
      expect(await hootToken.circulatingSupply()).to.equal(INITIAL_SUPPLY);
    });

    it("remainingMintable 应该返回正确的可铸造量", async function () {
      const remaining = MAX_SUPPLY - INITIAL_SUPPLY;
      expect(await hootToken.remainingMintable()).to.equal(remaining);
    });
  });
});
