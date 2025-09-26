import ScrollEffects from '@/components/ScrollEffects';
import CountUp from '@/components/CountUp';

export default async function Home() {
  let active = false;
  let avgPickupSeconds: number | null = null;
  let activeVansCount: number | null = null;
  let ridesFyCount: number | null = null;
  try {
    const r = await fetch(`/api/health`, { cache: 'no-store' });
    if (r.ok) { const d = await r.json(); active = Boolean(d.active); }
  } catch {}
  try {
    const s = await fetch(`/api/stats/summary`, { cache: 'no-store' });
    if (s.ok) {
      const d = await s.json();
      avgPickupSeconds = typeof d.avgSeconds==='number' ? d.avgSeconds : null;
      activeVansCount = typeof d.activeVans==='number' ? d.activeVans : null;
      ridesFyCount = typeof d.ridesFY==='number' ? d.ridesFY : null;
    }
  } catch {}

  return (
    <div className={`relative min-h-screen overflow-hidden text-foreground ambient-bg ${active ? 'ambient-active' : 'ambient-inactive'}`}>
      {/* Ambient gradient orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div data-orb data-speed="0.10" className="absolute left-[-10%] top-[-10%]">
          <div className="orb orb-bg1 h-72 w-72" />
        </div>
        <div data-orb data-speed="0.14" className="absolute right-[-10%] top-[10%]">
          <div className="orb orb-bg2 h-80 w-80" style={{ animationDelay:'-6s'}} />
        </div>
        <div data-orb data-speed="0.12" className="absolute left-[10%] bottom-[-10%]">
          <div className="orb orb-bg3 h-96 w-96" style={{ animationDuration:'18s'}} />
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between rounded-b-2xl glass">
          <a href="/" className="font-extrabold tracking-tight">SADD</a>
          <nav className="flex items-center gap-3 text-sm">
            <a href="/volunteer" className="opacity-90 hover:opacity-100">Volunteer</a>
            <a href="/login" className="rounded-full px-4 py-2 ring-gradient glass-strong">Login</a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="relative mx-auto max-w-7xl px-4">
        <ScrollEffects />
        <section className="pt-14 pb-10 sm:pt-20 sm:pb-14 grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-5" data-reveal>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs glass border border-white/20">
              <span className={`inline-block h-2 w-2 rounded-full ${active? 'bg-emerald-500':'bg-zinc-400'}`} />
              <span>{active ? 'SADD is Active' : 'SADD Currently Inactive'}</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight">
              Get <span className="gradient-text">Home Safe</span>.<br />Free. Confidential.
            </h1>
            <p className="text-base sm:text-lg opacity-80 max-w-prose">
              Soldiers Against Drunk Driving provides no-questions-asked rides so you and your unit stay safe. On-base and nearby.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <a href="/request" className="btn-primary will-change-transform">
                <span className="font-semibold">Request a Ride</span>
              </a>
              <a href="/volunteer" className="rounded-full px-6 py-3 glass border border-white/30 text-sm">
                Become a Volunteer
              </a>
            </div>
            <ul className="flex flex-wrap gap-2 text-xs opacity-80">
              <li className="glass rounded-full px-2.5 py-1 border border-white/20">Free</li>
              <li className="glass rounded-full px-2.5 py-1 border border-white/20">Confidential</li>
              <li className="glass rounded-full px-2.5 py-1 border border-white/20">On-Base & Nearby</li>
              <li className="glass rounded-full px-2.5 py-1 border border-white/20">Volunteer-Run</li>
            </ul>
          </div>

          {/* Showcase Card */}
          <div className="relative card-border rounded-3xl p-1" data-reveal>
            <div className="rounded-[22px] glass-strong p-5">
              <div className="rounded-2xl bg-gradient-to-br from-white/70 to-white/30 dark:from-white/10 dark:to-white/5 border border-white/30 p-5">
                <h3 className="text-lg font-semibold mb-2">How It Works</h3>
                <ol className="space-y-3 text-sm opacity-90">
                  <li>1) Request: share pickup and destination.</li>
                  <li>2) Dispatch: a dispatcher assigns the nearest van.</li>
                  <li>3) Ride: get home safe — no questions asked.</li>
                </ol>
                <div className="mt-5 grid grid-cols-3 gap-3 text-center text-sm">
                  <Stat label="Active Vans" valueNumber={activeVansCount} />
                  <Stat label="Average Pickup Time" valueNumber={avgPickupSeconds!=null? Math.round(avgPickupSeconds/60): null} suffix=" min" />
                  <Stat label="Rides (FY)" valueNumber={ridesFyCount} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature tiles */}
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-12" data-reveal>
          <Tile title="Always Free" desc="Zero cost rides provided by volunteers across the community." icon="💸" />
          <Tile title="Confidential" desc="We don’t ask why — we just get you home." icon="🛡️" />
          <Tile title="Coordinated Fleet" desc="Dispatch assigns the closest available van to reduce wait time." icon="🚐" />
        </section>

        {/* Callout */}
        <section className="mb-16 text-center" data-reveal>
          <div className="inline-flex items-center gap-3 rounded-2xl glass-strong px-6 py-4 border border-white/30">
            <span className="text-lg">Don’t risk it — request a ride now.</span>
            <a href="/request" className="btn-primary">Request</a>
          </div>
        </section>
      </main>

      {/* Footer is provided by the global layout */}
    </div>
  );
}

function Stat({ label, value, valueNumber, suffix }: { label: string; value?: string; valueNumber?: number|null; suffix?: string }){
  return (
    <div className="glass rounded-xl py-3 border border-white/20 sheen" data-sheen>
      <div className="text-xl font-semibold">
        {valueNumber!=null ? <CountUp value={valueNumber} suffix={suffix} /> : (value ?? '—')}
      </div>
      <div className="text-xs opacity-80">{label}</div>
    </div>
  );
}

function Tile({ title, desc, icon }: { title: string; desc: string; icon: string }){
  return (
    <div className="group glass rounded-2xl p-5 border border-white/20 transition-transform will-change-transform hover:-translate-y-0.5">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="font-semibold mb-1">{title}</div>
      <div className="opacity-80 text-sm">{desc}</div>
    </div>
  );
}

function formatAvg(seconds: number | null): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return '—';
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '<1 min';
  return `${mins} min`;
}
