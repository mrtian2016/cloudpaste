import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静态导出配置 - 构建为 SPA
  output: 'export',

  // 可选：配置图片优化（静态导出时需要）
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
