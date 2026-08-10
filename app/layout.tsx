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
  description: "通过重复打字练习 CET、IELTS、TOEFL、PTE、TEM 完整词库与例句，同时提升拼写记忆与键盘熟练度。",
  openGraph: {
    title: "VibeTyping | 打字背单词",
    description: "Type it. Remember it. 12,217 个单词与 11,871 条例句的完整打字记忆练习。",
    images: [{ url: "/og-library.png", width: 1200, height: 630, alt: "VibeTyping 完整词库打字背诵" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeTyping | 打字背单词",
    description: "Type it. Remember it. 12,217 个单词与 11,871 条例句的完整打字记忆练习。",
    images: ["/og-library.png"],
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
