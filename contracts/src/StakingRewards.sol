// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title StakingRewards
 * @dev HOOT 质押分红合约
 *
 * 质押类型：
 * - A 类：空投获得，权重固定 1.0x
 * - B 类：购买获得，权重 1.0x - 3.0x（根据质押时长）
 *
 * 分红机制：
 * - 分红以 USDT 发放
 * - 按加权质押量计算分红
 * - 周期性发放（管理员触发）
 *
 * 权重计算（B类）：
 * - 质押 0 天：1.0x
 * - 质押 365 天：3.0x
 * - 线性增长：weight = 1.0 + (daysStaked / 365) * 2.0
 */
contract StakingRewards is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // HOOT 代币
    IERC20 public immutable hootToken;
    // USDT 分红代币
    IERC20 public immutable rewardsToken;

    // 质押类型
    enum StakeType { A, B }

    // 质押记录
    struct Stake {
        uint256 amount;      // 质押数量
        StakeType stakeType; // 质押类型
        uint256 stakedAt;    // 质押时间
        uint256 lockUntil;   // 锁定截止时间（B类可选）
    }

    // 用户质押记录
    mapping(address => Stake[]) public userStakes;

    // 用户总质押量
    mapping(address => uint256) public userTotalStaked;

    // 用户待领取分红
    mapping(address => uint256) public pendingRewards;

    // 全网总质押量
    uint256 public totalStaked;

    // 全网总加权质押量（用于分红计算）
    uint256 public totalWeightedStaked;

    // 分红周期
    uint256 public rewardsPeriod = 7 days;
    uint256 public lastRewardsTime;

    // 最小质押量
    uint256 public minStakeAmount = 100 * 10**18; // 100 HOOT

    // B类锁定期选项（天数）
    uint256[] public lockPeriods = [0, 30, 90, 180, 365];

    // 权重精度（1e18 = 1.0x）
    uint256 public constant WEIGHT_PRECISION = 1e18;
    uint256 public constant MAX_WEIGHT = 3e18; // 3.0x

    // 事件
    event Staked(address indexed user, uint256 amount, StakeType stakeType, uint256 lockDays);
    event Unstaked(address indexed user, uint256 stakeIndex, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardsDistributed(uint256 totalAmount, uint256 totalWeighted, uint256 timestamp);
    event MinStakeAmountUpdated(uint256 oldAmount, uint256 newAmount);

    constructor(
        address _hootToken,
        address _rewardsToken,
        address initialOwner
    ) Ownable(initialOwner) {
        hootToken = IERC20(_hootToken);
        rewardsToken = IERC20(_rewardsToken);
        lastRewardsTime = block.timestamp;
    }

    // ==================== 质押操作 ====================

    /**
     * @dev 质押 HOOT（B类，可选锁定期）
     * @param amount 质押数量
     * @param lockDays 锁定天数（0, 30, 90, 180, 365）
     */
    function stake(uint256 amount, uint256 lockDays) external nonReentrant whenNotPaused {
        require(amount >= minStakeAmount, "Below minimum stake");
        require(_isValidLockPeriod(lockDays), "Invalid lock period");

        // 转入 HOOT
        hootToken.safeTransferFrom(msg.sender, address(this), amount);

        // 计算锁定截止时间
        uint256 lockUntil = lockDays > 0 ? block.timestamp + (lockDays * 1 days) : 0;

        // 创建质押记录
        userStakes[msg.sender].push(Stake({
            amount: amount,
            stakeType: StakeType.B,
            stakedAt: block.timestamp,
            lockUntil: lockUntil
        }));

        // 更新统计
        userTotalStaked[msg.sender] += amount;
        totalStaked += amount;
        _updateTotalWeighted();

        emit Staked(msg.sender, amount, StakeType.B, lockDays);
    }

    /**
     * @dev 空投质押（仅管理员，用于空投 A 类代币）
     * @param user 用户地址
     * @param amount 质押数量
     */
    function stakeAirdrop(address user, uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be positive");

        // 从合约持有的代币中分配
        // 注意：需要先将代币转入合约

        // 创建 A 类质押记录
        userStakes[user].push(Stake({
            amount: amount,
            stakeType: StakeType.A,
            stakedAt: block.timestamp,
            lockUntil: 0 // A 类无锁定
        }));

        // 更新统计
        userTotalStaked[user] += amount;
        totalStaked += amount;
        _updateTotalWeighted();

        emit Staked(user, amount, StakeType.A, 0);
    }

    /**
     * @dev 批量空投质押
     * @param users 用户地址数组
     * @param amounts 质押数量数组
     */
    function batchStakeAirdrop(
        address[] calldata users,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(users.length == amounts.length, "Arrays length mismatch");

        for (uint256 i = 0; i < users.length; i++) {
            if (amounts[i] > 0) {
                userStakes[users[i]].push(Stake({
                    amount: amounts[i],
                    stakeType: StakeType.A,
                    stakedAt: block.timestamp,
                    lockUntil: 0
                }));

                userTotalStaked[users[i]] += amounts[i];
                totalStaked += amounts[i];

                emit Staked(users[i], amounts[i], StakeType.A, 0);
            }
        }

        _updateTotalWeighted();
    }

    /**
     * @dev 解除质押
     * @param stakeIndex 质押记录索引
     */
    function unstake(uint256 stakeIndex) external nonReentrant {
        Stake[] storage stakes = userStakes[msg.sender];
        require(stakeIndex < stakes.length, "Invalid stake index");

        Stake storage stakeRecord = stakes[stakeIndex];
        require(stakeRecord.amount > 0, "Already unstaked");

        // B 类检查锁定期
        if (stakeRecord.stakeType == StakeType.B && stakeRecord.lockUntil > 0) {
            require(block.timestamp >= stakeRecord.lockUntil, "Still locked");
        }

        uint256 amount = stakeRecord.amount;

        // 更新统计
        userTotalStaked[msg.sender] -= amount;
        totalStaked -= amount;

        // 清零质押记录
        stakeRecord.amount = 0;

        _updateTotalWeighted();

        // 转出 HOOT
        hootToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, stakeIndex, amount);
    }

    // ==================== 分红操作 ====================

    /**
     * @dev 分发分红（仅管理员）
     * @param totalRewardAmount 本次分红总额
     */
    function distributeRewards(uint256 totalRewardAmount) external onlyOwner nonReentrant {
        require(totalRewardAmount > 0, "Amount must be positive");
        require(totalWeightedStaked > 0, "No stakers");

        // 转入分红 USDT
        rewardsToken.safeTransferFrom(msg.sender, address(this), totalRewardAmount);

        // 更新全网加权质押量
        _updateTotalWeighted();

        // 遍历所有质押者计算分红
        // 注意：实际生产中应该使用快照机制或 Merkle Tree 分发
        // 这里为了简化，使用链下计算 + 链上领取模式

        lastRewardsTime = block.timestamp;

        emit RewardsDistributed(totalRewardAmount, totalWeightedStaked, block.timestamp);
    }

    /**
     * @dev 设置用户待领取分红（仅管理员，用于链下计算后上链）
     * @param users 用户地址数组
     * @param amounts 分红金额数组
     */
    function setPendingRewards(
        address[] calldata users,
        uint256[] calldata amounts
    ) external onlyOwner {
        require(users.length == amounts.length, "Arrays length mismatch");

        for (uint256 i = 0; i < users.length; i++) {
            pendingRewards[users[i]] += amounts[i];
        }
    }

    /**
     * @dev 领取分红
     */
    function claimRewards() external nonReentrant {
        uint256 reward = pendingRewards[msg.sender];
        require(reward > 0, "No rewards to claim");

        pendingRewards[msg.sender] = 0;

        rewardsToken.safeTransfer(msg.sender, reward);

        emit RewardsClaimed(msg.sender, reward);
    }

    // ==================== 查询函数 ====================

    /**
     * @dev 获取用户质押记录
     */
    function getUserStakes(address user) external view returns (Stake[] memory) {
        return userStakes[user];
    }

    /**
     * @dev 获取用户质押记录数量
     */
    function getUserStakeCount(address user) external view returns (uint256) {
        return userStakes[user].length;
    }

    /**
     * @dev 计算质押权重
     * @param stakeType 质押类型
     * @param stakedAt 质押时间
     * @param lockDays 锁定天数（用于 B 类初始权重）
     */
    function calculateWeight(
        StakeType stakeType,
        uint256 stakedAt,
        uint256 lockDays
    ) public view returns (uint256) {
        // A 类固定 1.0x
        if (stakeType == StakeType.A) {
            return WEIGHT_PRECISION;
        }

        // B 类根据时长计算
        uint256 daysStaked = (block.timestamp - stakedAt) / 1 days;

        // 如果有锁定期，取较大值
        uint256 effectiveDays = daysStaked > lockDays ? daysStaked : lockDays;

        // weight = 1.0 + (effectiveDays / 365) * 2.0
        uint256 weight = WEIGHT_PRECISION + (effectiveDays * 2 * WEIGHT_PRECISION) / 365;

        // 最大 3.0x
        return weight > MAX_WEIGHT ? MAX_WEIGHT : weight;
    }

    /**
     * @dev 获取用户加权质押量
     */
    function getUserWeightedStaked(address user) public view returns (uint256) {
        Stake[] storage stakes = userStakes[user];
        uint256 weighted = 0;

        for (uint256 i = 0; i < stakes.length; i++) {
            if (stakes[i].amount > 0) {
                uint256 lockDays = stakes[i].lockUntil > stakes[i].stakedAt
                    ? (stakes[i].lockUntil - stakes[i].stakedAt) / 1 days
                    : 0;

                uint256 weight = calculateWeight(
                    stakes[i].stakeType,
                    stakes[i].stakedAt,
                    lockDays
                );

                weighted += (stakes[i].amount * weight) / WEIGHT_PRECISION;
            }
        }

        return weighted;
    }

    // ==================== 管理函数 ====================

    /**
     * @dev 更新最小质押量
     */
    function setMinStakeAmount(uint256 newAmount) external onlyOwner {
        uint256 oldAmount = minStakeAmount;
        minStakeAmount = newAmount;
        emit MinStakeAmountUpdated(oldAmount, newAmount);
    }

    /**
     * @dev 暂停合约
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 恢复合约
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 紧急提取（仅管理员，用于紧急情况）
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ==================== 内部函数 ====================

    function _isValidLockPeriod(uint256 days_) internal view returns (bool) {
        for (uint256 i = 0; i < lockPeriods.length; i++) {
            if (lockPeriods[i] == days_) return true;
        }
        return false;
    }

    function _updateTotalWeighted() internal {
        // 注意：这个实现会消耗大量 gas
        // 生产环境应该使用增量更新或链下计算
        // 这里仅作示例
    }
}
