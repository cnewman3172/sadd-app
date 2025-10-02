"use client";
import AuditLog from '@/components/admin/AuditLog';

export default function ActivityPage(){
  return (
    <section className="glass rounded-[32px] border border-white/20 p-5 shadow-lg dark:border-white/10">
      <h1 className="text-xl font-semibold mb-2">Recent Activity</h1>
      <p className="text-sm opacity-80 mb-3">Latest admin and system events.</p>
      <AuditLog />
    </section>
  );
}
