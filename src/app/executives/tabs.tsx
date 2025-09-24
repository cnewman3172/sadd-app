"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/executives', label: 'Dashboard' },
  { href: '/executives/analytics', label: 'Analytics' },
  { href: '/executives/users', label: 'Users' },
  { href: '/executives/vans', label: 'Vans' },
  { href: '/executives/shifts', label: 'Shifts' },
  { href: '/executives/training', label: 'Training' },
];

export default function TabNav(){
  const pathname = usePathname() || '';
  return (
    <nav className="border-b border-black/10 dark:border-white/20 overflow-x-auto">
      <ul className="flex gap-2">
        {tabs.map(t => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                className={`inline-block px-3 py-2 text-sm rounded-t ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
