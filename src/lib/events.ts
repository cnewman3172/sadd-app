type Writer = WritableStreamDefaultWriter<string>;

const clients = new Set<Writer>();

function writeSSE(writer: Writer, event: string, data: any){
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  return writer.write(`event: ${event}\n` + `data: ${payload}\n\n`);
}

export function publish(event: string, data: any){
  for (const w of [...clients]){
    w.ready?.then(()=> writeSSE(w, event, data)).catch(()=>{
      try { w.releaseLock?.(); } catch {}
      clients.delete(w);
    });
  }
}

export function sseResponse(){
  const ts = new TransformStream<string, Uint8Array>({
    transform(chunk, controller){
      controller.enqueue(new TextEncoder().encode(chunk));
    }
  });
  const writer = ts.writable.getWriter();
  clients.add(writer);
  // initial comment + ping every 15s
  writeSSE(writer, 'hello', { ok: true });
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
  setTimeout(()=>{ try{ writer.close(); }catch{} clients.delete(writer); clearInterval(ping); }, 21600000);
  return response;
}

