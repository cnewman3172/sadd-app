import dynamic from 'next/dynamic';
const Map = dynamic(() => import('../../components/Map'), { ssr: false });

export default function Dashboard(){
  return (
    <div className="p-6 max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-4">
        <Card title="Live Ops">
          <div className="text-sm space-y-1">
            <div>Active Vans: 0</div>
            <div>Pickups In Progress: 0</div>
            <div>Total Pickups (session): 0</div>
          </div>
        </Card>
        <Card title="Active Fleet">
          <div className="text-sm opacity-80">No vans online.</div>
        </Card>
      </div>
      <div className="md:col-span-2 space-y-4">
        <Card title="Live Operations Map">
          <Map height={500} markers={[]} />
        </Card>
        <Card title="Smart Assignment">
          <div className="text-sm opacity-80">Auto-assigns requests to optimal vans based on wait time, detour, and capacity.</div>
        </Card>
      </div>
    </div>
  );
}

function Card({title, children}:{title:string, children:any}){
  return (
    <section className="rounded-2xl p-4 bg-white/70 dark:bg-white/10 backdrop-blur border border-white/20">
      <h2 className="font-semibold mb-2">{title}</h2>
      {children}
    </section>
  );
}

