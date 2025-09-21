import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavSwitcher from '@/components/NavSwitcher';
import ScrollEffects from '@/components/ScrollEffects';
import ToastHost from '@/components/Toast';

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const base = process.env.NEXT_PUBLIC_APP_URL || '';
  let active = false;
  try {
    const r = await fetch(`${base}/api/health`, { cache: 'no-store' });
    if (r.ok) { const d = await r.json(); active = Boolean(d.active); }
  } catch {}
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground ambient-bg ${active ? 'ambient-active':'ambient-inactive'}`}
      >
        <NavSwitcher />
        <ScrollEffects />
        <main className="pt-2">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 py-10 text-sm opacity-80">
          © 2025 Arctic Aura Designs, Soldiers Against Drunk Driving · <a className="underline" href="/privacy">Privacy</a> · <a className="underline" href="/volunteer">Volunteer</a>
        </footer>
        <ToastHost />
      </body>
    </html>
  );
}
