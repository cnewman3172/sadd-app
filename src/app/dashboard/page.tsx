import { requireRoles, requireActiveShift } from '@/lib/guards';
import DashboardClient from './DashboardClient';

export default async function Page(){
  const user = await requireRoles(['ADMIN','DISPATCHER']);
  await requireActiveShift(user!, 'DISPATCHER');
  return <DashboardClient />;
}
