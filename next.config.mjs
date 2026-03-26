/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: 52428800, // 50MB (50 * 1024 * 1024 bytes) - 支持多平台图标上传
    },
  },
  // Fix recharts/d3 ESM compatibility with webpack
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    // Handle d3/internmap ESM modules
    config.module.rules.push({
      test: /\.js$/,
      include: /node_modules\/(d3-.*|internmap|delaunator|robust-predicates)/,
      resolve: {
        fullySpecified: false,
      },
    });
    return config;
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

