"use client";
import { usePathname } from 'next/navigation';
import TopNav from '@/components/TopNav';

export default function NavSwitcher(){
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <TopNav/>;
}

