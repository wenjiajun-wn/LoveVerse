import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'LoveVerse · 恋爱宇宙',
  description: '在浩瀚宇宙里，收藏只属于我们的微光。',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
