export default function Driving(){
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Truck Commander</h1>
      <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
        <button className="rounded px-4 py-2 bg-black text-white">Go Online</button>
        <div className="mt-3 text-sm opacity-80">Status: Offline</div>
      </section>
      <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
        <h2 className="font-semibold mb-2">Tasks</h2>
        <div className="text-sm opacity-80">No tasks yet.</div>
      </section>
    </div>
  );
}

