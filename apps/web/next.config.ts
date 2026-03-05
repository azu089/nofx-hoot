import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Docker 部署需要 standalone 输出
  output: "standalone",

  // 防止部署后浏览器缓存旧 HTML 导致 Server Action 找不到 → 黑屏
  // 仅对 HTML 页面路由（无扩展名）生效，图片/字体/静态资源不受影响
  async headers() {
    return [
      {
        // 匹配无文件扩展名的路径（即 HTML 页面），排除 _next/ 和 api/
        source: "/((?!_next/|api/)(?:[^.]*$))",
        headers: [
          {
            key: "Cache-Control",
            // no-cache: 浏览器重新验证，若内容未变服务器返回 304（不重新下载）
            // 图片/字体等有各自的 Cache-Control，不会被覆盖
            value: "no-cache, must-revalidate",
          },
        ],
      },
    ];
  },

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
