"use client";
import { useEffect, useState } from 'react';

export default function Audit(){
  const [items, setItems] = useState<any[]>([]);
  useEffect(()=>{ fetch('/api/audit?take=300').then(r=>r.json()).then(setItems); },[]);
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <div className="rounded-xl p-4 bg-white/70 dark:bg-white/10 border border-white/20 overflow-x-auto">
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
              <tr key={i.id} className="border-t border-white/20 align-top">
                <td className="py-2 whitespace-nowrap">{new Date(i.createdAt).toLocaleString()}</td>
                <td className="whitespace-nowrap">{i.action}</td>
                <td className="whitespace-nowrap">{i.actorId||'—'}</td>
                <td className="whitespace-nowrap">{i.subject||'—'}</td>
                <td className="text-xs opacity-80">{i.details ? JSON.stringify(i.details) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

