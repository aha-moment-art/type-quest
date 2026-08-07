import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VibeTyping | 打字背单词",
  description: "通过重复打字练习 IELTS、TOEFL 词汇，同时提升拼写记忆与键盘熟练度。",
  openGraph: {
    title: "VibeTyping | 打字背单词",
    description: "Type it. Remember it. 用重复输入强化 IELTS、TOEFL 词汇记忆。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "VibeTyping 打字背单词" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeTyping | 打字背单词",
    description: "Type it. Remember it. 用重复输入强化 IELTS、TOEFL 词汇记忆。",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
