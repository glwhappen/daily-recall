/** @type {import('next').NextConfig} */
const nextConfig = {
  // 不再是纯静态导出：加了账号与反馈之后必须有服务端。
  // 「不配数据库就退化成纯本地模式」由运行时配置决定，见 src/server/config.ts。
  // 想要纯静态托管（GitHub Pages 等）请用 v1.0.0 tag。
  reactStrictMode: true,
  // 产出独立的最小运行目录（.next/standalone），镜像里不需要整个 node_modules
  output: 'standalone',
};

export default nextConfig;
