import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("=".repeat(60));
  console.log("HOOT 智能合约部署脚本");
  console.log("=".repeat(60));
  console.log("部署账户:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("账户余额:", ethers.formatEther(balance), "BNB");
  console.log("");

  // 1. 部署 HOOT Token
  console.log("[1/3] 部署 HOOT Token...");
  const HOOTToken = await ethers.getContractFactory("HOOTToken");
  const hootToken = await HOOTToken.deploy(deployer.address);
  await hootToken.waitForDeployment();

  const hootAddress = await hootToken.getAddress();
  console.log("✅ HOOT Token 已部署:", hootAddress);

  // 验证初始状态
  const totalSupply = await hootToken.totalSupply();
  console.log("   初始供应量:", ethers.formatEther(totalSupply), "HOOT");
  console.log("");

  // 2. 获取 USDT 地址（测试网使用模拟 USDT）
  // BSC 测试网 USDT: 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd
  // BSC 主网 USDT: 0x55d398326f99059fF775485246999027B3197955
  const networkName = (await ethers.provider.getNetwork()).name;
  let usdtAddress: string;

  if (networkName === "bscTestnet" || networkName === "unknown") {
    // 测试网或本地网络，部署一个模拟 USDT
    console.log("[2/3] 部署模拟 USDT（测试用）...");
    const MockUSDT = await ethers.getContractFactory("HOOTToken"); // 复用 ERC20
    const mockUsdt = await MockUSDT.deploy(deployer.address);
    await mockUsdt.waitForDeployment();
    usdtAddress = await mockUsdt.getAddress();
    console.log("✅ 模拟 USDT 已部署:", usdtAddress);
  } else {
    // 主网使用真实 USDT
    usdtAddress = "0x55d398326f99059fF775485246999027B3197955";
    console.log("[2/3] 使用 BSC 主网 USDT:", usdtAddress);
  }
  console.log("");

  // 3. 部署 StakingRewards
  console.log("[3/3] 部署 StakingRewards...");
  const StakingRewards = await ethers.getContractFactory("StakingRewards");
  const stakingRewards = await StakingRewards.deploy(
    hootAddress,
    usdtAddress,
    deployer.address
  );
  await stakingRewards.waitForDeployment();

  const stakingAddress = await stakingRewards.getAddress();
  console.log("✅ StakingRewards 已部署:", stakingAddress);
  console.log("");

  // 4. 配置关联
  console.log("[配置] 设置 HOOT Token 的质押合约地址...");
  const setTx = await hootToken.setStakingContract(stakingAddress);
  await setTx.wait();
  console.log("✅ 配置完成");
  console.log("");

  // 5. 输出部署结果
  console.log("=".repeat(60));
  console.log("部署完成！合约地址汇总：");
  console.log("=".repeat(60));
  console.log("HOOT Token:     ", hootAddress);
  console.log("StakingRewards: ", stakingAddress);
  console.log("USDT (分红代币):", usdtAddress);
  console.log("");
  console.log("请将以上地址保存到 .env 文件：");
  console.log(`HOOT_TOKEN_ADDRESS=${hootAddress}`);
  console.log(`STAKING_CONTRACT_ADDRESS=${stakingAddress}`);
  console.log(`USDT_ADDRESS=${usdtAddress}`);
  console.log("=".repeat(60));

  // 6. 验证合约（仅在测试网/主网）
  if (networkName !== "hardhat" && networkName !== "unknown") {
    console.log("");
    console.log("验证合约...");
    console.log("运行以下命令验证合约：");
    console.log(`npx hardhat verify --network ${networkName} ${hootAddress} ${deployer.address}`);
    console.log(`npx hardhat verify --network ${networkName} ${stakingAddress} ${hootAddress} ${usdtAddress} ${deployer.address}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("部署失败:", error);
    process.exit(1);
  });
