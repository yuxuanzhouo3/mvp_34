/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // 腾讯云云托管需要 standalone 模式
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  // 安全头配置
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // 防止点击劫持
          { key: 'X-Frame-Options', value: 'DENY' },
          // 防止 MIME 类型嗅探
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // XSS 防护（现代浏览器已内置，但仍建议设置）
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // 控制 Referrer 信息泄露
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 权限策略（限制敏感 API 访问）
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
}

export default nextConfig
