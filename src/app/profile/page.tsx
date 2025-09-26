import { requireRoles } from '@/lib/guards';
import ProfileClient from './ProfileClient';

export default async function Page(){
  await requireRoles(['ADMIN','DISPATCHER','TC','DRIVER','SAFETY','RIDER']);
  return <ProfileClient />;
}
