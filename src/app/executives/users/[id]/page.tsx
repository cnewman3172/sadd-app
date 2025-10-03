import { notFound } from 'next/navigation';

type UserView = {
  id: string; email: string; firstName: string; lastName: string; role: string;
  vmisRegistered: boolean; volunteerAgreement: boolean; saddSopRead: boolean;
  trainingSafetyAt: string|null; trainingDriverAt: string|null; trainingTcAt: string|null; trainingDispatcherAt: string|null;
  checkRide: boolean; createdAt: string;
  rank: string|null; unit: string|null; phone: string|null;
};

async function getUser(id: string): Promise<UserView|null>{
  try{
    const r = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/admin/users/${id}`, { cache:'no-store' });
    if (!r.ok) return null;
    return await r.json();
  }catch{ return null; }
}

export default async function UserViewPage({ params }: { params: Promise<{ id: string }> }){
  const { id } = await params;
  const u = await getUser(id);
  if (!u) return notFound();
  const date = (iso: string|null)=> iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'UTC', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—';
  return (
    <section className="space-y-4">
      <div><a href="/executives" className="text-sm opacity-80 hover:opacity-100">← Back to Executives</a></div>
      <div className="glass w-full max-w-3xl rounded-[32px] border border-white/20 p-6 shadow-lg dark:border-white/10">
        <h2 className="text-xl font-semibold mb-3">{u.firstName} {u.lastName}</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <Field label="Email" value={u.email} />
          <Field label="Role" value={u.role} />
          <Field label="Rank" value={u.rank} />
          <Field label="Unit" value={u.unit} />
          <Field label="Phone" value={u.phone} />
          <Field label="VMIS Registered" value={u.vmisRegistered ? 'Yes' : 'No'} />
          <Field label="Volunteer Agreement" value={u.volunteerAgreement ? 'Yes' : 'No'} />
          <Field label="SADD SOP Read" value={u.saddSopRead ? 'Yes' : 'No'} />
          <Field label="Check Ride" value={u.checkRide ? 'Yes' : 'No'} />
          <Field label="Training: Safety" value={date(u.trainingSafetyAt)} />
          <Field label="Training: Driver" value={date(u.trainingDriverAt)} />
          <Field label="Training: TC" value={date(u.trainingTcAt)} />
          <Field label="Training: Dispatcher" value={date(u.trainingDispatcherAt)} />
          <Field label="Created" value={date(u.createdAt)} />
        </div>
      </div>
    </section>
  );
}

function Field({ label, value }: { label:string; value: string | null }){
  const display = value && value.trim() ? value : '—';
  return (
    <div>
      <div className="text-xs opacity-70">{label}</div>
      <div className="px-3 py-2 rounded border glass">{display}</div>
    </div>
  );
}
