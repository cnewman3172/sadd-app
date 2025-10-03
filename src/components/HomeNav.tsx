"use client";
import Link from 'next/link';
import AccountMenuButton from '@/components/AccountMenuButton';
import useCurrentUser, { type CurrentUser } from '@/hooks/useCurrentUser';
import { usePathname } from 'next/navigation';

type Role = NonNullable<CurrentUser['role']>;

const ROLE_DESTINATIONS: Record<Role, { href: string; label: string }> = {
  ADMIN: { href: '/executives', label: 'Executives' },
  DISPATCHER: { href: '/dashboard', label: 'Dispatch' },
  TC: { href: '/driving', label: 'Truck Commanders' },
  DRIVER: { href: '/shifts', label: 'Driver Shifts' },
  SAFETY: { href: '/shifts', label: 'Safety Shifts' },
  RIDER: { href: '/request', label: 'Request a Ride' },
};

export default function HomeNav() {
  const { user, loading } = useCurrentUser();
  const pathname = usePathname();
  const overridePrimary = pathname === '/' || pathname === '/volunteer' || pathname === '/privacy' || pathname === '/tos';
  const rolePrimaryLink = overridePrimary && user?.role
    ? ROLE_DESTINATIONS[user.role as Role] ?? null
    : undefined;

  const accountButton = user ? (
    <AccountMenuButton
      user={user}
      buttonClassName="rounded-full px-4 py-2 ring-gradient glass-strong text-zinc-900 dark:text-white font-medium"
      primaryLink={rolePrimaryLink}
    />
  ) : (
    <Link
      href="/login"
      className="rounded-full px-4 py-2 ring-gradient glass-strong text-zinc-900 dark:text-white font-medium"
    >
      Login
    </Link>
  );

  return (
    <header className="sticky top-0 z-20">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between rounded-b-2xl glass">
        <Link href="/" className="font-extrabold tracking-tight">
          SADD
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/volunteer" className="opacity-90 hover:opacity-100">
            Volunteer
          </Link>
          {loading ? (
            <span className="inline-block rounded-full px-4 py-2 ring-gradient glass-strong opacity-0" aria-hidden />
          ) : (
            accountButton
          )}
        </nav>
      </div>
    </header>
  );
}
