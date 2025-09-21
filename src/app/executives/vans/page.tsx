"use client";
import Fleet from '@/components/admin/Fleet';

export default function VansPage(){
  return (
    <section className="rounded-xl p-4 bg-white text-black dark:bg-neutral-900 dark:text-white border border-black/10 dark:border-white/20">
      <h2 className="font-semibold mb-3">Vans</h2>
      <Fleet />
    </section>
  );
}
