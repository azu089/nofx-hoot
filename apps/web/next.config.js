/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 输出独立构建（便于 Docker 部署）
  output: 'standalone',
}

module.exports = nextConfig
