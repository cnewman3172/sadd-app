import type { ReactNode } from 'react';
import PageShell from '@/components/PageShell';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell pad={false} widthClassName="max-w-5xl">
      <div className="mx-auto w-full max-w-3xl px-4 py-12 space-y-8">
        {children}
      </div>
    </PageShell>
  );
}
