import type { ReactNode } from 'react';
import TabNav from './tabs';
import { requireRoles } from '@/lib/guards';

export default async function ExecutivesLayout({ children }: { children: ReactNode }){
  await requireRoles(['ADMIN']);
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Executives</h1>
      <TabNav />
      <div className="mt-4">
        {children}
      </div>
    </div>
  );
}
