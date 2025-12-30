import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 部署 QFI Token
  const QFIToken = await ethers.getContractFactory("QFIToken");
  const token = await QFIToken.deploy(deployer.address);

  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  console.log("QFI Token deployed to:", tokenAddress);

  // 验证初始状态
  const name = await token.name();
  const symbol = await token.symbol();
  const totalSupply = await token.totalSupply();
  const ownerBalance = await token.balanceOf(deployer.address);

  console.log("\n=== Token Info ===");
  console.log("Name:", name);
  console.log("Symbol:", symbol);
  console.log("Total Supply:", ethers.formatEther(totalSupply), "QFI");
  console.log("Owner Balance:", ethers.formatEther(ownerBalance), "QFI");
  console.log("Max Supply:", ethers.formatEther(await token.MAX_SUPPLY()), "QFI");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
