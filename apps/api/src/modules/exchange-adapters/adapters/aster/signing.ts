/**
 * Aster DEX — ECDSA 签名模块
 *
 * 移植自 NoFx trader/aster/trader.go sign() 方法
 *
 * 签名流程：
 *   1. JSON.stringify(params)
 *   2. ABI 编码: (string jsonStr, address user, address signer, uint256 nonce)
 *   3. keccak256(encoded) → hash
 *   4. "\x19Ethereum Signed Message:\n32" + hash → keccak256 → prefixed
 *   5. ECDSA 签名 prefixed → signature (r + s + v)
 *
 * 依赖: ethers v6 (已安装)
 */

import { ethers } from 'ethers';

/**
 * 生成 Aster 请求签名
 *
 * @param jsonStr JSON 字符串（请求参数序列化）
 * @param userAddress 主钱包地址
 * @param signerAddress 签名钱包地址
 * @param privateKey 签名钱包私钥（hex, with or without 0x）
 * @returns { signature, nonce }
 */
export function signAsterRequest(
  jsonStr: string,
  userAddress: string,
  signerAddress: string,
  privateKey: string,
): { signature: string; nonce: string } {
  // 1. 生成微秒级 nonce（移植自 NoFx genNonce）
  const nonce = BigInt(Date.now()) * 1000n;

  // 2. ABI 编码 (string, address, address, uint256)
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ['string', 'address', 'address', 'uint256'],
    [jsonStr, userAddress, signerAddress, nonce],
  );

  // 3. keccak256(encoded)
  const hash = ethers.keccak256(encoded);

  // 4. Ethereum Signed Message prefix
  //    "\x19Ethereum Signed Message:\n32" + hash → keccak256
  const prefixed = ethers.keccak256(
    ethers.concat([
      ethers.toUtf8Bytes('\x19Ethereum Signed Message:\n32'),
      hash,
    ]),
  );

  // 5. ECDSA 签名（raw sign, 不添加额外 prefix）
  const normalizedKey = privateKey.startsWith('0x')
    ? privateKey
    : `0x${privateKey}`;
  const signingKey = new ethers.SigningKey(normalizedKey);
  const sig = signingKey.sign(prefixed);

  // 6. 拼接 r + s + v (v=27 或 28)
  const signature = ethers.concat([
    sig.r,
    sig.s,
    ethers.toBeHex(sig.v, 1),
  ]);

  return {
    signature: ethers.hexlify(signature),
    nonce: nonce.toString(),
  };
}

/**
 * 生成微秒级 Nonce
 * 移植自 NoFx genNonce()
 */
export function genNonce(): string {
  return (BigInt(Date.now()) * 1000n).toString();
}
