/**
 * wagmi Web3 配置
 * 支持 BSC 和 Ethereum 网络
 */
import { http, createConfig, createStorage, cookieStorage } from 'wagmi'
import { bsc, bscTestnet, mainnet } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'

// WalletConnect 项目 ID（可在 cloud.walletconnect.com 获取）
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

// 支持的链
export const chains = [bsc, bscTestnet, mainnet] as const

// 创建 wagmi 配置
export const config = createConfig({
  chains,
  connectors: [
    // MetaMask、OKX 等浏览器钱包
    injected({
      shimDisconnect: true,
    }),
    // WalletConnect（支持 100+ 移动钱包）
    walletConnect({
      projectId,
      showQrModal: true,
      metadata: {
        name: 'HOOT',
        description: 'AI 量化交易平台',
        url: 'https://hoot.io',
        icons: ['/icons/hoot/logo.png'],
      },
    }),
    // Coinbase Wallet
    coinbaseWallet({
      appName: 'HOOT',
      appLogoUrl: '/icons/hoot/logo.png',
    }),
  ],
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  transports: {
    [bsc.id]: http(),
    [bscTestnet.id]: http(),
    [mainnet.id]: http(),
  },
})

// 导出类型
declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
