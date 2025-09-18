export default function Executives(){
  return (
    <div className="p-6 max-w-6xl mx-auto grid gap-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="grid md:grid-cols-4 gap-4">
        <section className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20 md:col-span-3">
          <h2 className="font-semibold mb-3">Dashboard</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric title="Total Pickups" value="0" />
            <Metric title="Avg Pickup" value="—" />
            <Metric title="Avg Dropoff" value="—" />
            <Metric title="No-Show Rate" value="—" />
          </div>
          <div className="mt-4">
            <form action="/api/admin/toggle-active" method="post">
              <button className="rounded px-4 py-2 border">Toggle SADD Active</button>
            </form>
          </div>
        </section>
        <aside className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20">
          <nav className="grid gap-2 text-sm">
            <a className="underline" href="#dashboard">Dashboard</a>
            <a className="underline" href="#analytics">Analytics</a>
            <a className="underline" href="#users">Users</a>
            <a className="underline" href="#fleet">Fleet</a>
          </nav>
        </aside>
      </div>
    </div>
  );
}

function Metric({title, value}:{title:string; value:string}){
  return (
    <div className="rounded-lg p-3 bg-white/60 dark:bg-white/5 border border-white/20">
      <div className="text-xs opacity-70">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

