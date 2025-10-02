import type { ReactNode } from 'react';
import PageShell from '@/components/PageShell';

export default function ExecutivesLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell pad={false} widthClassName="max-w-7xl">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
        {children}
      </div>
    </PageShell>
  );
}
