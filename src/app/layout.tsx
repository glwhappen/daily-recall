import type { Metadata, Viewport } from 'next';
import { AppProvider } from '@/components/AppProvider';
import './globals.css';

export const metadata: Metadata = {
  title: '每日回忆 · Daily Recall',
  description:
    '每天几道题，看看你还记得多少。同一个日子隔几天再问一次，用跨天校验看出自己的记忆漂移。数据只存在你自己的浏览器里。',
  applicationName: 'Daily Recall',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: '每日回忆', statusBarStyle: 'default' },
  // favicon.ico 由 app/favicon.ico 自动注入，这里只补 iOS 主屏图标
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 手机上更像 App：禁掉双指缩放
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#131417' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
