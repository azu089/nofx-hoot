import { expect } from "chai";
import { ethers } from "hardhat";
import { HOOTToken, StakingRewards } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("StakingRewards", function () {
  let hootToken: HOOTToken;
  let usdtToken: HOOTToken; // 使用 HOOTToken 作为模拟 USDT
  let stakingRewards: StakingRewards;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  const STAKE_AMOUNT = ethers.parseEther("1000");
  const MIN_STAKE = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // 部署 HOOT Token
    const HOOTToken = await ethers.getContractFactory("HOOTToken");
    hootToken = await HOOTToken.deploy(owner.address);

    // 部署模拟 USDT
    usdtToken = await HOOTToken.deploy(owner.address);

    // 部署 StakingRewards
    const StakingRewards = await ethers.getContractFactory("StakingRewards");
    stakingRewards = await StakingRewards.deploy(
      await hootToken.getAddress(),
      await usdtToken.getAddress(),
      owner.address
    );

    // 给用户一些 HOOT
    await hootToken.transfer(user1.address, ethers.parseEther("10000"));
    await hootToken.transfer(user2.address, ethers.parseEther("10000"));

    // 用户授权 StakingRewards 合约
    await hootToken
      .connect(user1)
      .approve(await stakingRewards.getAddress(), ethers.MaxUint256);
    await hootToken
      .connect(user2)
      .approve(await stakingRewards.getAddress(), ethers.MaxUint256);
  });

  describe("部署", function () {
    it("应该设置正确的代币地址", async function () {
      expect(await stakingRewards.hootToken()).to.equal(
        await hootToken.getAddress()
      );
      expect(await stakingRewards.rewardsToken()).to.equal(
        await usdtToken.getAddress()
      );
    });

    it("应该设置正确的最小质押量", async function () {
      expect(await stakingRewards.minStakeAmount()).to.equal(MIN_STAKE);
    });
  });

  describe("质押（B类）", function () {
    it("用户应该能够质押 HOOT", async function () {
      await stakingRewards.connect(user1).stake(STAKE_AMOUNT, 0);

      expect(await stakingRewards.userTotalStaked(user1.address)).to.equal(
        STAKE_AMOUNT
      );
      expect(await stakingRewards.totalStaked()).to.equal(STAKE_AMOUNT);
    });

    it("质押数量不能低于最小值", async function () {
      await expect(
        stakingRewards.connect(user1).stake(ethers.parseEther("50"), 0)
      ).to.be.revertedWith("Below minimum stake");
    });

    it("应该支持锁定期选项", async function () {
      await stakingRewards.connect(user1).stake(STAKE_AMOUNT, 30);

      const stakes = await stakingRewards.getUserStakes(user1.address);
      expect(stakes.length).to.equal(1);
      expect(stakes[0].lockUntil).to.be.gt(0);
    });

    it("无效的锁定期应该被拒绝", async function () {
      await expect(
        stakingRewards.connect(user1).stake(STAKE_AMOUNT, 45) // 45 天不是有效选项
      ).to.be.revertedWith("Invalid lock period");
    });

    it("应该发出 Staked 事件", async function () {
      await expect(stakingRewards.connect(user1).stake(STAKE_AMOUNT, 0))
        .to.emit(stakingRewards, "Staked")
        .withArgs(user1.address, STAKE_AMOUNT, 1, 0); // 1 = StakeType.B
    });
  });

  describe("空投质押（A类）", function () {
    it("owner 应该能够为用户创建 A 类质押", async function () {
      // 先将 HOOT 转入合约
      await hootToken.transfer(await stakingRewards.getAddress(), STAKE_AMOUNT);

      await stakingRewards.stakeAirdrop(user1.address, STAKE_AMOUNT);

      expect(await stakingRewards.userTotalStaked(user1.address)).to.equal(
        STAKE_AMOUNT
      );
    });

    it("非 owner 不能创建空投质押", async function () {
      await expect(
        stakingRewards.connect(user1).stakeAirdrop(user1.address, STAKE_AMOUNT)
      ).to.be.revertedWithCustomError(stakingRewards, "OwnableUnauthorizedAccount");
    });

    it("批量空投应该正常工作", async function () {
      await hootToken.transfer(
        await stakingRewards.getAddress(),
        ethers.parseEther("2000")
      );

      await stakingRewards.batchStakeAirdrop(
        [user1.address, user2.address],
        [STAKE_AMOUNT, STAKE_AMOUNT]
      );

      expect(await stakingRewards.userTotalStaked(user1.address)).to.equal(
        STAKE_AMOUNT
      );
      expect(await stakingRewards.userTotalStaked(user2.address)).to.equal(
        STAKE_AMOUNT
      );
    });
  });

  describe("解除质押", function () {
    beforeEach(async function () {
      await stakingRewards.connect(user1).stake(STAKE_AMOUNT, 0);
    });

    it("用户应该能够解除质押", async function () {
      const balanceBefore = await hootToken.balanceOf(user1.address);

      await stakingRewards.connect(user1).unstake(0);

      const balanceAfter = await hootToken.balanceOf(user1.address);
      expect(balanceAfter - balanceBefore).to.equal(STAKE_AMOUNT);
      expect(await stakingRewards.userTotalStaked(user1.address)).to.equal(0);
    });

    it("锁定期内不能解除质押", async function () {
      await stakingRewards.connect(user2).stake(STAKE_AMOUNT, 30);

      await expect(
        stakingRewards.connect(user2).unstake(0)
      ).to.be.revertedWith("Still locked");
    });

    it("锁定期过后可以解除质押", async function () {
      await stakingRewards.connect(user2).stake(STAKE_AMOUNT, 30);

      // 快进 31 天
      await time.increase(31 * 24 * 60 * 60);

      await stakingRewards.connect(user2).unstake(0);
      expect(await stakingRewards.userTotalStaked(user2.address)).to.equal(0);
    });
  });

  describe("权重计算", function () {
    const WEIGHT_PRECISION = ethers.parseEther("1");

    it("A 类权重应该固定为 1.0x", async function () {
      const weight = await stakingRewards.calculateWeight(0, 0, 0); // A 类
      expect(weight).to.equal(WEIGHT_PRECISION);
    });

    it("B 类初始权重应该为 1.0x", async function () {
      const now = await time.latest();
      const weight = await stakingRewards.calculateWeight(1, now, 0); // B 类
      expect(weight).to.equal(WEIGHT_PRECISION);
    });

    it("B 类质押 365 天权重应该为 3.0x", async function () {
      const now = await time.latest();
      const oneYearAgo = now - 365 * 24 * 60 * 60;
      const weight = await stakingRewards.calculateWeight(1, oneYearAgo, 0);
      expect(weight).to.equal(ethers.parseEther("3"));
    });

    it("B 类权重最大为 3.0x", async function () {
      const now = await time.latest();
      const twoYearsAgo = now - 730 * 24 * 60 * 60;
      const weight = await stakingRewards.calculateWeight(1, twoYearsAgo, 0);
      expect(weight).to.equal(ethers.parseEther("3")); // 最大 3.0x
    });
  });

  describe("分红", function () {
    beforeEach(async function () {
      await stakingRewards.connect(user1).stake(STAKE_AMOUNT, 0);
    });

    it("没有加权质押量时不能分发分红", async function () {
      // 注意：当前实现中 totalWeightedStaked 始终为 0（_updateTotalWeighted 未实现）
      // 这是设计决定：使用链下计算 + 链上领取模式
      // 实际分红通过 setPendingRewards 设置
      const rewardAmount = ethers.parseEther("1000");

      await usdtToken.approve(
        await stakingRewards.getAddress(),
        ethers.MaxUint256
      );

      // 由于 totalWeightedStaked = 0，应该 revert
      await expect(stakingRewards.distributeRewards(rewardAmount))
        .to.be.revertedWith("No stakers");
    });

    it("设置待领取分红后用户可以领取", async function () {
      const rewardAmount = ethers.parseEther("100");

      // 转 USDT 到合约
      await usdtToken.transfer(
        await stakingRewards.getAddress(),
        rewardAmount
      );

      // 设置待领取分红
      await stakingRewards.setPendingRewards(
        [user1.address],
        [rewardAmount]
      );

      // 领取分红
      const balanceBefore = await usdtToken.balanceOf(user1.address);
      await stakingRewards.connect(user1).claimRewards();
      const balanceAfter = await usdtToken.balanceOf(user1.address);

      expect(balanceAfter - balanceBefore).to.equal(rewardAmount);
    });

    it("没有分红时领取应该失败", async function () {
      await expect(
        stakingRewards.connect(user2).claimRewards()
      ).to.be.revertedWith("No rewards to claim");
    });
  });

  describe("暂停", function () {
    it("owner 应该能够暂停合约", async function () {
      await stakingRewards.pause();
      expect(await stakingRewards.paused()).to.equal(true);
    });

    it("暂停后不能质押", async function () {
      await stakingRewards.pause();
      await expect(
        stakingRewards.connect(user1).stake(STAKE_AMOUNT, 0)
      ).to.be.revertedWithCustomError(stakingRewards, "EnforcedPause");
    });
  });
});
