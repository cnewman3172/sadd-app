import { requireRoles } from '@/lib/guards';
import dynamic from 'next/dynamic';

const RequestClient = dynamic(() => import('./RequestClient'), { ssr: false });

export default async function Page(){
  await requireRoles(['ADMIN','DISPATCHER','TC','DRIVER','SAFETY','RIDER']);
  return <RequestClient />;
}

