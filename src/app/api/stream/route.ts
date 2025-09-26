import { sseResponse } from '@/lib/events';
import { verifyJwt } from '@/lib/jwt';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  const auth = await verifyJwt(token);
  if (!auth) return new Response('forbidden', { status: 403 });
  const res = sseResponse();
  // piggyback: append an auth event immediately by forcing a small delay
  setTimeout(async ()=>{
    try{
      // The events module sends initial hello/ping; clients will make a /api/me call if needed.
    }catch{}
  }, 10);
  return res;
}
