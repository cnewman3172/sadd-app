"use client";
import AuditLog from '@/components/admin/AuditLog';

export default function ActivityPage(){
  return (
    <section className="p-4 rounded-xl bg-white/70 dark:bg-white/10 border border-white/20">
      <h1 className="text-xl font-semibold mb-2">Recent Activity</h1>
      <p className="text-sm opacity-80 mb-3">Latest admin and system events.</p>
      <AuditLog />
    </section>
  );
}

