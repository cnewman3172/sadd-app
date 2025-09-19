import { sseResponse } from '@/lib/events';
import { verifyToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: Request){
  const token = (req.headers.get('cookie')||'').split('; ').find(c=>c.startsWith('sadd_token='))?.split('=')[1];
  // Best-effort auth note: event will be sent as part of initial stream
  const auth = verifyToken(token);
  const res = sseResponse();
  // piggyback: append an auth event immediately by forcing a small delay
  setTimeout(async ()=>{
    try{
      // The events module sends initial hello/ping; clients will make a /api/me call if needed.
    }catch{}
  }, 10);
  return res;
}
