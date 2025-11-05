'use client';

import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { useTauriConfig } from "@/lib/hooks/useTauriConfig";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 移除静态 metadata，因为使用了 'use client'
// export const metadata: Metadata = {
//   title: "CloudPaste - 云剪贴板",
//   description: "跨设备剪贴板历史同步工具",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 自动同步配置到 Tauri 后端（用于剪贴板同步）
  useTauriConfig();

  return (
    <html lang="zh-CN">
      <head>
        <title>CloudPaste - 云剪贴板</title>
        <meta name="description" content="跨设备剪贴板历史同步工具" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            className: 'text-sm sm:text-base',
          }}
        />
      </body>
    </html>
  );
}
