"use client";
import { useEffect, useState } from 'react';

export default function AuditLog(){
  const [items, setItems] = useState<any[]>([]);
  useEffect(()=>{ fetch('/api/audit?take=300').then(r=>r.json()).then(setItems); },[]);
  return (
    <div className="rounded-xl p-4 bg-white text-black dark:bg-neutral-900 dark:text-white border border-black/10 dark:border-white/20 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left opacity-70">
            <th className="py-2">Time</th>
            <th>Action</th>
            <th>Actor</th>
            <th>Subject</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i:any)=> (
            <tr key={i.id} className="border-t border-black/10 dark:border-white/20 align-top">
              <td className="py-2 whitespace-nowrap">{new Date(i.createdAt).toLocaleString('en-US', { timeZone: 'UTC', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })} UTC</td>
              <td className="whitespace-nowrap">{i.action}</td>
              <td className="whitespace-nowrap">{i.actorId||'—'}</td>
              <td className="whitespace-nowrap">{i.subject||'—'}</td>
              <td className="text-xs opacity-80">{i.details ? JSON.stringify(i.details) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
