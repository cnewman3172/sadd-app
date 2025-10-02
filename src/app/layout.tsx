import type { Metadata } from "next";
import { cookies } from 'next/headers';
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavSwitcher from '@/components/NavSwitcher';
import ScrollEffects from '@/components/ScrollEffects';
import ToastHost from '@/components/Toast';
import NotificationsClient from '@/components/NotificationsClient';
import { getPublicActive } from '@/lib/status';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';

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
    icon: [
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: "/icons/apple-touch-icon.png",
    shortcut: "/favicon.png"
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let active = false;
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('theme')?.value as 'light'|'dark'|'system'|undefined;
  const isAuthed = Boolean(cookieStore.get('sadd_token')?.value);
  try { active = await getPublicActive(); } catch {}
  return (
    <html lang="en" suppressHydrationWarning {...(themeCookie && themeCookie!=='system' ? { 'data-theme': themeCookie } : {})}
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground ambient-bg ${active ? 'ambient-active':'ambient-inactive'}`}
      >
        <NavSwitcher />
        <ScrollEffects />
        <PwaInstallPrompt />
        {isAuthed ? <NotificationsClient /> : null}
        <main className="pt-2">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 py-10 text-sm opacity-80">
          © 2025 Arctic Aura Designs, Soldiers Against Drunk Driving · <a className="underline" href="/privacy">Privacy</a> · <a className="underline" href="/volunteer">Volunteer</a>
        </footer>
        <ToastHost />
      </body>
    </html>
  );
}
