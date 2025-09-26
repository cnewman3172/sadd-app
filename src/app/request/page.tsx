import { requireRoles } from '@/lib/guards';
import RequestClient from './RequestClient';

export default async function Page(){
  await requireRoles(['ADMIN','DISPATCHER','TC','DRIVER','SAFETY','RIDER']);
  return <RequestClient />;
}
