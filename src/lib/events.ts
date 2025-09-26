type Writer = WritableStreamDefaultWriter<string>;
type Client = { w: Writer; role: string; userId: string };

const clients = new Set<Client>();

function writeSSE(writer: Writer, event: string, data: any){
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  return writer.write(`event: ${event}\n` + `data: ${payload}\n\n`);
}

export function publish(event: string, data: any){
  const staffOnly = event === 'vans:location';
  for (const c of [...clients]){
    if (staffOnly && !['ADMIN','DISPATCHER','TC'].includes(c.role)) continue;
    c.w.ready?.then(()=> writeSSE(c.w, event, data)).catch(()=>{
      try { c.w.releaseLock?.(); } catch {}
      clients.delete(c);
    });
  }
}

export function sseResponse(init?: Array<{ event: string; data: any }>, ctx?: { role: string; userId: string }){
  const ts = new TransformStream<string, Uint8Array>({
    transform(chunk, controller){
      controller.enqueue(new TextEncoder().encode(chunk));
    }
  });
  const writer = ts.writable.getWriter();
  clients.add({ w: writer, role: ctx?.role || 'RIDER', userId: ctx?.userId || '' });
  // initial events
  writeSSE(writer, 'hello', { ok: true });
  if (init && init.length){
    for (const e of init){ writeSSE(writer, e.event, e.data); }
  }
  const ping = setInterval(()=>{ writeSSE(writer, 'ping', Date.now()); }, 15000);
  const stream = ts.readable;
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  const response = new Response(stream, { headers });
  // cleanup when GC'd
  response.headers.set('Transfer-Encoding','chunked');
  // Best-effort cleanup after 6 hours
  setTimeout(()=>{ try{ writer.close(); }catch{} clients.forEach(c=>{ if (c.w === writer) clients.delete(c); }); clearInterval(ping); }, 21600000);
  return response;
}
