import Link from 'next/link';
import ScrollEffects from '@/components/ScrollEffects';
import CountUp from '@/components/CountUp';
import { getPublicActive, getHomeSummary } from '@/lib/status';

export const dynamic = 'force-dynamic';

type HomeSummary = Awaited<ReturnType<typeof getHomeSummary>>;

export default async function Home() {
  const active = await getPublicActive().catch(()=>false);
  const summaryFallback: HomeSummary = { avgSeconds: null, activeVans: null, ridesFY: null, sample: 0 };
  const { avgSeconds: avgPickupSeconds, activeVans: activeVansCount, ridesFY: ridesFyCount } = await getHomeSummary().catch<HomeSummary>(()=> ({ ...summaryFallback }));

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
          <Link href="/" className="font-extrabold tracking-tight">SADD</Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/volunteer" className="opacity-90 hover:opacity-100">Volunteer</Link>
            <Link href="/login" className="rounded-full px-4 py-2 ring-gradient glass-strong">Login</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="relative mx-auto max-w-6xl px-4 pb-20">
        <ScrollEffects />
        <section className="relative mt-14 overflow-hidden rounded-[36px] border border-white/20 bg-white/60 px-6 py-14 shadow-lg backdrop-blur-2xl dark:border-white/10 dark:bg-white/5" data-reveal>
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -right-16 top-10 h-64 w-64 rounded-full bg-emerald-400/30 blur-3xl dark:bg-emerald-500/20" />
            <div className="absolute -bottom-20 left-0 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl dark:bg-sky-500/20" />
            <div className="absolute inset-0 bg-gradient-to-tr from-white/40 via-transparent to-white/10 dark:from-white/10" />
          </div>

          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <div className="space-y-6 lg:pr-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/50 px-4 py-1.5 text-xs uppercase tracking-wide text-emerald-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-emerald-300">
                <span className={`inline-block h-2.5 w-2.5 rounded-full shadow-inner ${active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                <span>{active ? 'SADD is Active • Vans on shift' : 'SADD Currently Inactive • Check schedule'}</span>
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-zinc-900 sm:text-5xl lg:text-6xl dark:text-white">
                A glass-smooth safety net to <span className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-500 bg-clip-text text-transparent">get you home</span>, every night.
              </h1>
              <p className="text-base text-zinc-600 sm:text-lg dark:text-zinc-200/80">
                Soldiers Against Drunk Driving pairs duty-night volunteers with real-time dispatching so every Soldier has a confidential, judgment-free ride back to safety.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/request" className="btn-primary flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-lg shadow-emerald-500/20">
                  <span>Request a Ride</span>
                  <span aria-hidden className="text-lg">→</span>
                </Link>
                <Link href="/volunteer" className="flex items-center justify-center rounded-full border border-white/40 bg-white/60 px-6 py-3 text-sm font-semibold text-zinc-900 shadow-sm backdrop-blur-lg transition hover:border-emerald-400/60 dark:border-white/10 dark:bg-white/5 dark:text-white">
                  Join the Volunteer Roster
                </Link>
              </div>
              <ul className="flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-200/70">
                {['Free rides', 'Confidential', 'On-base & nearby', 'Volunteer-run'].map(item => (
                  <li key={item} className="rounded-full border border-white/40 bg-white/60 px-3 py-1 backdrop-blur dark:border-white/10 dark:bg-white/5">
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">Trusted by</span>
                <span className="rounded-full border border-white/40 bg-white/60 px-3 py-1 backdrop-blur dark:border-white/10 dark:bg-white/5">Brigade Staff Duty</span>
                <span className="rounded-full border border-white/40 bg-white/60 px-3 py-1 backdrop-blur dark:border-white/10 dark:bg-white/5">Command Teams</span>
                <span className="rounded-full border border-white/40 bg-white/60 px-3 py-1 backdrop-blur dark:border-white/10 dark:bg-white/5">Unit Volunteers</span>
              </div>
            </div>

            <div className="relative flex flex-col gap-5" data-reveal>
              <div className="relative overflow-hidden rounded-[28px] border border-white/40 bg-white/70 p-6 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
                <div className="absolute -right-16 top-0 h-36 w-36 rounded-full bg-emerald-400/20 blur-2xl dark:bg-emerald-500/30" />
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">Operations snapshot</h3>
                    <p className="text-2xl font-semibold text-zinc-900 dark:text-white">Tonight at a glance</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <Stat label="Active Vans" valueNumber={activeVansCount} />
                    <Stat label="Avg Pickup" valueNumber={avgPickupSeconds!=null? Math.round(avgPickupSeconds/60): null} suffix=" min" />
                    <Stat label="Rides (FY)" valueNumber={ridesFyCount} />
                  </div>
                  <div className="grid gap-3 text-left text-sm text-zinc-600 dark:text-zinc-300">
                    {[
                      { title: 'Dispatch assigns nearest van', detail: 'Live map + staffing roster keeps response tight.' },
                      { title: 'Walk-ons welcome', detail: 'Truck Commanders can add riders on the fly to keep groups together.' },
                      { title: 'No judgment, ever', detail: 'Our volunteers log pickups — never personal stories.' },
                    ].map(({ title, detail }) => (
                      <div key={title} className="rounded-2xl border border-white/40 bg-white/50 p-3 backdrop-blur dark:border-white/10 dark:bg-white/5">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-300">{title}</div>
                        <div className="text-sm mt-1 opacity-80">{detail}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/40 bg-white/50 p-5 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">How it works</h3>
                <ol className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
                  <li className="flex items-start gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/60 text-xs font-semibold backdrop-blur dark:border-white/10 dark:bg-white/10">1</span>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">Request</p>
                      <p className="opacity-80">Share pickup & drop-off — no explanations needed.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/60 text-xs font-semibold backdrop-blur dark:border-white/10 dark:bg-white/10">2</span>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">Dispatch</p>
                      <p className="opacity-80">Our dispatcher pings the closest on-duty van.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/40 bg-white/60 text-xs font-semibold backdrop-blur dark:border-white/10 dark:bg-white/10">3</span>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white">Ride</p>
                      <p className="opacity-80">Get home safe and check in when you arrive.</p>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-3" data-reveal>
          <Tile title="Always Free" desc="Every ride is fully covered by SADD — no reimbursements, no IOUs." icon="💸" accent="from-emerald-300/50 to-emerald-500/20" />
          <Tile title="Confidential" desc="Only dispatch sees the ride details. Your chain of command does not." icon="🛡️" accent="from-blue-300/50 to-blue-500/20" />
          <Tile title="Coordinated Fleet" desc="Live van locations keep pickup times low even on high-demand nights." icon="🚐" accent="from-purple-300/50 to-indigo-500/20" />
        </section>

        <section className="mt-16 grid gap-6 lg:grid-cols-[1fr_1fr]" data-reveal>
          <div className="overflow-hidden rounded-[30px] border border-white/30 bg-white/60 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">Why volunteers love it</h3>
              <span className="rounded-full border border-white/40 bg-white/60 px-3 py-1 text-xs backdrop-blur dark:border-white/10 dark:bg-white/10">Give back safely</span>
            </div>
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
              TCs, dispatchers, and drivers run SADD like a cohesive crew. Training is quick, shifts are flexible, and every ride logged keeps Soldiers — and careers — protected.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                { title: 'Flexible shifts', detail: 'Pick nights that work around duty and family life.' },
                { title: 'Team comms', detail: 'Push alerts and live dashboards keep everyone synced.' },
                { title: 'Impact metrics', detail: 'See how many Soldiers your team got home this month.' },
                { title: 'Support ready', detail: 'Coordinators are on-call if you need backup mid-shift.' },
              ].map(item => (
                <div key={item.title} className="rounded-2xl border border-white/40 bg-white/60 p-3 text-sm backdrop-blur dark:border-white/10 dark:bg-white/10">
                  <p className="font-semibold text-zinc-900 dark:text-white">{item.title}</p>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-300">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex h-full flex-col justify-between gap-5 rounded-[30px] border border-white/30 bg-gradient-to-br from-emerald-400/15 via-cyan-400/10 to-blue-500/10 p-6 backdrop-blur-xl dark:border-white/10 dark:from-emerald-500/15 dark:via-cyan-500/10 dark:to-blue-600/10">
            <div>
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-white">Ready when you are</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Save the request link, add it to your phone, and share it with your battle buddies. When the night runs long, SADD is already staged.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/request" className="flex-1 rounded-2xl border border-white/50 bg-white/70 px-4 py-3 text-center text-sm font-semibold text-emerald-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-emerald-300">
                Save Request Link
              </Link>
              <Link href="/login" className="flex-1 rounded-2xl border border-white/50 bg-white/70 px-4 py-3 text-center text-sm font-semibold text-cyan-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-cyan-300">
                Staff Login
              </Link>
            </div>
            <div className="rounded-2xl border border-white/40 bg-white/60 p-4 text-sm text-zinc-600 backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-zinc-300">
              <p className="font-semibold text-zinc-900 dark:text-white">Share the QR at safety briefs</p>
              <p className="mt-1 opacity-80">Print the homepage or add it to your unit slide deck so everyone knows a safe ride is one tap away.</p>
            </div>
          </div>
        </section>

        <section className="mt-16" data-reveal>
          <div className="flex flex-col items-center gap-6 rounded-[32px] border border-white/30 bg-white/70 px-8 py-10 text-center shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
            <p className="text-lg font-medium text-zinc-900 sm:text-xl dark:text-white">If it’s a question between driving or dialing, choose the glass-safe option — SADD.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/request" className="btn-primary flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
                Request a Ride Now
              </Link>
              <Link href="/volunteer" className="rounded-full border border-white/40 bg-white/60 px-6 py-3 text-sm font-semibold text-zinc-900 backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-white">
                Become a Volunteer
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer is provided by the global layout */}
    </div>
  );
}

function Stat({ label, value, valueNumber, suffix }: { label: string; value?: string; valueNumber?: number|null; suffix?: string }){
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-white/40 bg-white/70 py-4 text-zinc-900 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-white" data-sheen>
      <div className="text-2xl font-semibold">
        {valueNumber!=null ? <CountUp value={valueNumber} suffix={suffix} /> : (value ?? '—')}
      </div>
      <div className="text-[0.7rem] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{label}</div>
    </div>
  );
}

function Tile({ title, desc, icon, accent }: { title: string; desc: string; icon: string; accent?: string }){
  const gradient = accent ? `bg-gradient-to-br ${accent}` : 'bg-gradient-to-br from-white/40 via-white/20 to-white/10';
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-white/30 bg-white/60 p-6 shadow-lg backdrop-blur-xl transition-transform hover:-translate-y-1 dark:border-white/10 dark:bg-white/10">
      <div className={`absolute inset-0 -z-10 ${gradient} opacity-70 blur-3xl`} />
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/70 text-2xl backdrop-blur dark:bg-white/10">
        <span>{icon}</span>
      </div>
      <div className="mt-5 text-lg font-semibold text-zinc-900 dark:text-white">{title}</div>
      <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{desc}</div>
    </div>
  );
}
