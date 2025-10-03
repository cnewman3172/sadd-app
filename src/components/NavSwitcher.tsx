"use client";
import { usePathname } from 'next/navigation';
import TopNav from '@/components/TopNav';

export default function NavSwitcher(){
  const pathname = usePathname();
  if (pathname === '/' || pathname === '/volunteer' || pathname === '/privacy' || pathname === '/tos' || pathname === '/reset') {
    return null;
  }
  return <TopNav/>;
}
