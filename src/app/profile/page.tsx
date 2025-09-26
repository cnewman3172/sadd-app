import { requireRoles } from '@/lib/guards';
import dynamic from 'next/dynamic';

const ProfileClient = dynamic(() => import('./ProfileClient'), { ssr: false });

export default async function Page(){
  await requireRoles(['ADMIN','DISPATCHER','TC','DRIVER','SAFETY','RIDER']);
  return <ProfileClient />;
}

