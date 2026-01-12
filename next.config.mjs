/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // 腾讯云云托管需要 standalone 模式
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
