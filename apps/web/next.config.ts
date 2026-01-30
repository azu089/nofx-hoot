import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 部署需要 standalone 输出
  output: "standalone",

  // 图片优化配置
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // 环境变量
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001",
  },
};

export default nextConfig;
