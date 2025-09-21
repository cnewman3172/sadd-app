import crypto from 'crypto';

function b64url(buf: Buffer){
  return buf.toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

export function createConfirmToken(action: string, uid: string){
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const payload = { a: action, u: uid, t: Date.now() };
  const body = Buffer.from(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(body).digest();
  return `${b64url(body)}.${b64url(sig)}`;
}

export function verifyConfirmToken(token: string, action: string, maxAgeMs=5*60*1000){
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const [b64, sigB64] = token.split('.');
  if (!b64 || !sigB64) return null;
  const body = Buffer.from(b64.replace(/-/g,'+').replace(/_/g,'/'), 'base64');
  const expect = crypto.createHmac('sha256', secret).update(body).digest();
  const got = Buffer.from(sigB64.replace(/-/g,'+').replace(/_/g,'/'), 'base64');
  if (expect.length!==got.length || !crypto.timingSafeEqual(expect, got)) return null;
  try{
    const payload = JSON.parse(body.toString());
    if (payload.a !== action) return null;
    if (Date.now() - Number(payload.t) > maxAgeMs) return null;
    return payload as { a:string; u:string; t:number };
  }catch{ return null; }
}

