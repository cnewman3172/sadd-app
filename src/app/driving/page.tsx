import { requireRoles, requireActiveShift } from '@/lib/guards';
import dynamic from 'next/dynamic';

const DrivingClient = dynamic(() => import('./DrivingClient'), { ssr: false });

export default async function Page(){
  const user = await requireRoles(['ADMIN','DISPATCHER','TC']);
  await requireActiveShift(user!, 'TC');
  return <DrivingClient />;
}

