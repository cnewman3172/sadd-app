import type { ReactNode } from 'react';
import PageShell from '@/components/PageShell';
import TabNav from './tabs';
import { requireRoles } from '@/lib/guards';

export default async function ExecutivesLayout({ children }: { children: ReactNode }) {
  await requireRoles(['ADMIN']);
  return (
    <PageShell pad={false} widthClassName="max-w-7xl">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
        <header className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-semibold">Executives</h1>
          </div>
          <TabNav />
        </header>
        <div>{children}</div>
      </div>
    </PageShell>
  );
}
