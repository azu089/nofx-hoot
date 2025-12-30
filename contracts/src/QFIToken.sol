// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title QFI Token
 * @dev QuantFi 平台代币
 *
 * 功能：
 * 1. 标准 ERC20 代币
 * 2. 可销毁（用于回购销毁）
 * 3. 可暂停（紧急情况）
 * 4. 仅管理员可铸造
 *
 * 代币经济：
 * - 总供应量：100,000,000 QFI
 * - 网络：BSC (BEP-20)
 * - 精度：18 位
 */
contract QFIToken is ERC20, ERC20Burnable, Ownable, Pausable {
    // 最大供应量：1亿 QFI
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18;

    // 已销毁总量
    uint256 public totalBurned;

    // 回购钱包地址
    address public buybackWallet;

    // 铸造事件
    event Minted(address indexed to, uint256 amount);

    // 销毁事件（覆盖父合约事件，添加更多信息）
    event TokensBurned(address indexed from, uint256 amount, uint256 totalBurned);

    // 回购销毁事件
    event BuybackBurned(uint256 usdtSpent, uint256 qfiBurned, uint256 price);

    // 回购钱包变更事件
    event BuybackWalletUpdated(address indexed oldWallet, address indexed newWallet);

    constructor(address initialOwner) ERC20("QuantFi Token", "QFI") Ownable(initialOwner) {
        // 初始铸造 1000 万给 owner（用于初始流动性和空投）
        _mint(initialOwner, 10_000_000 * 10**18);
    }

    /**
     * @dev 铸造代币（仅 owner）
     * @param to 接收地址
     * @param amount 铸造数量
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /**
     * @dev 销毁代币并记录
     * @param amount 销毁数量
     */
    function burn(uint256 amount) public override {
        super.burn(amount);
        totalBurned += amount;
        emit TokensBurned(msg.sender, amount, totalBurned);
    }

    /**
     * @dev 从指定账户销毁代币（需要授权）
     * @param account 账户地址
     * @param amount 销毁数量
     */
    function burnFrom(address account, uint256 amount) public override {
        super.burnFrom(account, amount);
        totalBurned += amount;
        emit TokensBurned(account, amount, totalBurned);
    }

    /**
     * @dev 回购销毁（仅 owner 或 buybackWallet）
     * @param usdtSpent 花费的 USDT
     * @param qfiBurned 销毁的 QFI 数量
     * @param price 成交价格（USDT per QFI，18 位精度）
     */
    function recordBuybackBurn(
        uint256 usdtSpent,
        uint256 qfiBurned,
        uint256 price
    ) external {
        require(
            msg.sender == owner() || msg.sender == buybackWallet,
            "Not authorized"
        );
        emit BuybackBurned(usdtSpent, qfiBurned, price);
    }

    /**
     * @dev 设置回购钱包
     * @param newBuybackWallet 新的回购钱包地址
     */
    function setBuybackWallet(address newBuybackWallet) external onlyOwner {
        require(newBuybackWallet != address(0), "Invalid address");
        address oldWallet = buybackWallet;
        buybackWallet = newBuybackWallet;
        emit BuybackWalletUpdated(oldWallet, newBuybackWallet);
    }

    /**
     * @dev 暂停所有转账（紧急情况）
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 恢复转账
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 查询实际流通量（总供应量 - 已销毁）
     */
    function circulatingSupply() external view returns (uint256) {
        return totalSupply();
    }

    /**
     * @dev 查询剩余可铸造量
     */
    function remainingMintable() external view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    /**
     * @dev 转账前检查（暂停状态）
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override whenNotPaused {
        super._update(from, to, value);
    }
}
