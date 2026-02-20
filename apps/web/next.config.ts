import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Docker 部署需要 standalone 输出
  output: "standalone",

  // 开发指示器位置（避免阻挡底部导航）
  devIndicators: {
    position: 'top-left',
  },

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
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001/api",
  },
};

export default withNextIntl(nextConfig);
