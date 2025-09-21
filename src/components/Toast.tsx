"use client";
import { useEffect, useState } from 'react';

type Msg = { id: number; text: string };

export function showToast(text: string){
  window.dispatchEvent(new CustomEvent('toast', { detail: text }));
}

export default function ToastHost(){
  const [msgs, setMsgs] = useState<Msg[]>([]);
  useEffect(()=>{
    let id = 1;
    function onToast(e: any){
      const msg: Msg = { id: id++, text: String(e.detail||'') };
      setMsgs((m)=> [...m, msg]);
      setTimeout(()=> setMsgs((m)=> m.filter(x=> x.id!==msg.id)), 3000);
    }
    window.addEventListener('toast', onToast);
    return ()=> window.removeEventListener('toast', onToast);
  },[]);
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {msgs.map(m=> (
        <div key={m.id} className="rounded bg-black text-white/90 dark:bg-white dark:text-black px-3 py-2 shadow">
          <div className="text-sm">{m.text}</div>
        </div>
      ))}
    </div>
  );
}

