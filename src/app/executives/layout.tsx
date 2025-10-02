import PageShell from '@/components/PageShell';

export default function ExecutivesLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell pad={false} widthClassName="max-w-7xl">
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        {children}
      </div>
    </PageShell>
  );
}
