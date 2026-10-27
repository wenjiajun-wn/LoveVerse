import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['playwright-core'],
  // 运行期私人数据必须单独挂载，绝不能被构建依赖追踪打入部署包。
  outputFileTracingExcludes: {
    '/*': [
      './private/**/*',
      './public/private/**/*',
      './.env*',
      './test-results/**/*',
      './playwright-report/**/*',
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default config;
