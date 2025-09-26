import { requireRoles, requireActiveShift } from '@/lib/guards';
import DrivingClient from './DrivingClient';

export default async function Page(){
  const user = await requireRoles(['ADMIN','DISPATCHER','TC']);
  await requireActiveShift(user!, 'TC');
  return <DrivingClient />;
}
