import { requireRoles, requireActiveShift } from '@/lib/guards';
import dynamic from 'next/dynamic';

const DashboardClient = dynamic(() => import('./DashboardClient'), { ssr: false });

export default async function Page(){
  const user = await requireRoles(['ADMIN','DISPATCHER']);
  await requireActiveShift(user!, 'DISPATCHER');
  return <DashboardClient />;
}

