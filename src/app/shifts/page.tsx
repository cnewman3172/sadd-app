import { requireRoles, requireTrainingForShifts } from '@/lib/guards';
import ShiftsClient from './ShiftsClient';

export default async function Page(){
  const user = await requireRoles(['ADMIN','DISPATCHER','TC','DRIVER','SAFETY']);
  await requireTrainingForShifts(user!);
  return <ShiftsClient />;
}
