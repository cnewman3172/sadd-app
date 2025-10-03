"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Dropdown, { type AnchorRect } from '@/components/Dropdown';
import type { CurrentUser } from '@/hooks/useCurrentUser';

type MenuLink = { href: string; label: string };

type AccountMenuButtonProps = {
  user: CurrentUser | null;
  buttonClassName?: string;
  containerClassName?: string;
  closeSignal?: number;
  onOpenChange?: (open: boolean) => void;
  fallbackLabel?: string;
  primaryLink?: MenuLink | null;
};

export default function AccountMenuButton({
  user,
  buttonClassName = 'rounded-full glass border border-white/20 px-3 py-1 text-sm',
  containerClassName = 'relative',
  closeSignal,
  onOpenChange,
  fallbackLabel = 'Account',
  primaryLink,
}: AccountMenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const updateAnchor = () => {
      if (buttonRef.current) {
        setAnchor(buttonRef.current.getBoundingClientRect());
      }
    };
    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, { passive: true });
    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor);
    };
  }, [open]);

  useEffect(() => {
    if (closeSignal === undefined) return;
    setOpen(false);
  }, [closeSignal]);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const name = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || fallbackLabel : fallbackLabel;
  const defaultPrimaryLink: MenuLink | null = user?.role && user.role !== 'RIDER'
    ? { href: '/training', label: 'Training' }
    : null;
  const resolvedPrimary = primaryLink === undefined ? defaultPrimaryLink : primaryLink;

  return (
    <div className={containerClassName}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={buttonClassName}
      >
        {name}
      </button>
      <Dropdown open={open} anchor={anchor} onClose={() => setOpen(false)}>
        {resolvedPrimary && (
          <Link
            href={resolvedPrimary.href}
            className="block px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            {resolvedPrimary.label}
          </Link>
        )}
        <Link
          href="/profile"
          className="block px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
          onClick={() => setOpen(false)}
        >
          Settings
        </Link>
        <button
          type="button"
          className="block w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
          onClick={async () => {
            setOpen(false);
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login';
          }}
        >
          Logout
        </button>
      </Dropdown>
    </div>
  );
}
