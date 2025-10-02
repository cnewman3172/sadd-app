import { requireRoles, requireActiveShift } from '@/lib/guards';
import DrivingClient from './DrivingClient';
import PageShell from '@/components/PageShell';

export default async function Page(){
  const user = await requireRoles(['ADMIN','DISPATCHER','TC']);
  await requireActiveShift(user!, 'TC');
  return (
    <PageShell pad={false}>
      <DrivingClient />
    </PageShell>
  );
}
