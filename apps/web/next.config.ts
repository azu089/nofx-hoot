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
    // 生产环境图片优化服务容易超时（504），对本地静态资源关闭优化
    // 本地 public/ 目录的图片（icon、exchange logo 等）已是 webp，无需再优化
    unoptimized: true,
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
