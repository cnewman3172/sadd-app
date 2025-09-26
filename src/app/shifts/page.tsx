import { requireRoles, requireTrainingForShifts } from '@/lib/guards';
import dynamic from 'next/dynamic';

const ShiftsClient = dynamic(() => import('./ShiftsClient'), { ssr: false });

export default async function Page(){
  const user = await requireRoles(['ADMIN','DISPATCHER','TC','DRIVER','SAFETY']);
  await requireTrainingForShifts(user!);
  return <ShiftsClient />;
}

