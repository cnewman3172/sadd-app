import type { ReactNode } from 'react';
import TabNav from './tabs';

export default function ExecutivesLayout({ children }: { children: ReactNode }){
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

