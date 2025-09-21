import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import dynamic from 'next/dynamic';

const TopNav = dynamic(()=> import('@/components/TopNav'), { ssr:false });
const ToastHost = dynamic(()=> import('@/components/Toast').then(m=> m.default), { ssr:false });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SADD — Soldiers Against Drunk Driving",
  description: "Free, confidential rides — built by Arctic Aura Designs.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <TopNav />
        <main className="pt-2">{children}</main>
        <ToastHost />
      </body>
    </html>
  );
}
