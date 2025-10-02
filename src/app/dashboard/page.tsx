import { requireRoles, requireActiveShift } from '@/lib/guards';
import DashboardClient from './DashboardClient';
import PageShell from '@/components/PageShell';

export default async function Page(){
  const user = await requireRoles(['ADMIN','DISPATCHER']);
  await requireActiveShift(user!, 'DISPATCHER');
  return (
    <PageShell pad={false}>
      <DashboardClient />
    </PageShell>
  );
}
