export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black/60 to-black/20 dark:from-black/80 text-foreground">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/60 dark:bg-black/40 border-b border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="text-xl font-semibold">SADD</div>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/volunteer" className="hover:underline">Volunteer</a>
            <a href="/login" className="rounded-full px-4 py-2 bg-white/80 text-black dark:bg-white/10 dark:text-white border border-white/20">Login</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 grid gap-6">
        <section className="rounded-2xl p-4 sm:p-6 bg-white/40 dark:bg-white/5 backdrop-blur border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">SADD Activity</p>
              <h2 className="text-2xl font-semibold">Currently Inactive</h2>
            </div>
            <a href="#request" className="hidden sm:inline-block rounded-full px-4 py-2 bg-black text-white dark:bg-white dark:text-black">Request a Ride</a>
          </div>
        </section>
        <section className="grid md:grid-cols-2 gap-6 items-center">
          <div className="rounded-3xl p-6 bg-white/50 dark:bg-white/5 backdrop-blur border border-white/20">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">Get home safe. Free and confidential.</h1>
            <p className="opacity-80 mb-4">Soldiers Against Drunk Driving (SADD) offers safe rides home. No questions asked.</p>
            <div className="flex gap-3">
              <a href="/request" className="rounded-full px-5 py-3 bg-black text-white dark:bg-white dark:text-black">Request a Ride</a>
              <a href="/volunteer" className="rounded-full px-5 py-3 border border-white/30">Become a Volunteer</a>
            </div>
          </div>
          <div className="rounded-3xl p-6 bg-white/50 dark:bg-white/5 backdrop-blur border border-white/20">
            <h3 className="text-lg font-semibold mb-4">How SADD Works</h3>
            <ol className="space-y-3 text-sm">
              <li><span className="font-semibold">1) Request a Ride:</span> Tell us pickup, destination, and party count.</li>
              <li><span className="font-semibold">2) Van Dispatched:</span> A coordinator assigns the closest van.</li>
              <li><span className="font-semibold">3) Arrive Home:</span> We drop you off safely and confidentially.</li>
            </ol>
          </div>
        </section>
        <section className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-2xl p-4 bg-white/50 dark:bg-white/5 backdrop-blur border border-white/20">
            <div className="text-3xl font-semibold">—</div>
            <div className="text-sm opacity-80">Avg Pickup Time</div>
          </div>
          <div className="rounded-2xl p-4 bg-white/50 dark:bg-white/5 backdrop-blur border border-white/20">
            <div className="text-3xl font-semibold">0</div>
            <div className="text-sm opacity-80">Active Vans</div>
          </div>
          <div className="rounded-2xl p-4 bg-white/50 dark:bg-white/5 backdrop-blur border border-white/20">
            <div className="text-3xl font-semibold">0</div>
            <div className="text-sm opacity-80">Rides (FY)</div>
          </div>
        </section>
        <section className="rounded-3xl p-6 bg-white/60 dark:bg-white/5 backdrop-blur border border-white/20 text-center">
          <h3 className="text-xl font-semibold mb-2">Need a ride? Don’t risk it.</h3>
          <p className="opacity-80 mb-4">Totally free and confidential. We’ve got you.</p>
          <a href="/request" className="rounded-full px-5 py-3 bg-black text-white dark:bg-white dark:text-black">Request a Ride</a>
        </section>
      </main>
      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm opacity-80">
        <div>© 2025 Arctic Aura Designs, Soldiers Against Drunk Driving — Built by <a className="underline" href="https://arcticauradesigns.com">Arctic Aura Designs</a>. Not Endorsed by the United States Army. <a className="underline ml-2" href="/tos">TOS</a> · <a className="underline" href="/privacy">Privacy</a> · <a className="underline" href="/volunteer">Become a Volunteer</a></div>
      </footer>
    </div>
  );
}
