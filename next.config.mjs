/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出：产出纯静态文件（out/），可托管在任意静态服务器 / GitHub Pages / Cloudflare Pages。
  // 本项目的 v1 不需要任何后端，所有数据存在浏览器 localStorage 里。
  output: 'export',
  images: { unoptimized: true },
  // 静态托管在子路径时（如 https://user.github.io/memory/）通过环境变量指定。
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
