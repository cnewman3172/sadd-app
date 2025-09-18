import { sseResponse } from '@/lib/events';

export const runtime = 'nodejs';

export async function GET(){
  return sseResponse();
}

