"use client";
import { useEffect, useMemo, useRef, useState } from 'react';

type Option = { label: string; lat: number; lon: number };

export default function AddressInput({
  label,
  placeholder,
  value,
  onSelect,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value?: string;
  onSelect: (opt: Option) => void;
  onChange?: (text: string) => void;
}){
  const rootRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState(value || "");
  const [opts, setOpts] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ setQ(value || ""); }, [value]);

  const debounced = useMemo(()=>{
    let t: any;
    return (fn: ()=>void)=>{ clearTimeout(t); t = setTimeout(fn, 250); };
  },[]);

  useEffect(()=>{
    if (!q || q.length < 3){ setOpts([]); return; }
    debounced(async()=>{
      try{
        setLoading(true);
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (r.ok){
          const data = await r.json();
          setOpts((data||[]).slice(0, 8).map((d:any)=>({ label: d.label, lat: Number(d.lat), lon: Number(d.lon) })));
          setOpen(true);
        }
      } finally { setLoading(false); }
    });
  }, [q, debounced]);

  // Close when clicking outside
  useEffect(()=>{
    function onDocClick(e: MouseEvent){
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDocClick);
    return ()=> document.removeEventListener('pointerdown', onDocClick);
  },[]);

  return (
    <div className="relative" ref={rootRef}>
      <label className="text-sm">{label}</label>
      <input
        className="w-full p-3 rounded border bg-white/80 dark:bg-neutral-800 text-black dark:text-white"
        placeholder={placeholder || "Address or place"}
        value={q}
        onChange={(e)=>{ setQ(e.target.value); onChange?.(e.target.value); if (!e.target.value || e.target.value.length<3) setOpen(false); }}
        onFocus={()=>{ if(opts.length>0) setOpen(true); }}
        onBlur={()=> setTimeout(()=> setOpen(false), 120)}
        onKeyDown={(e)=>{ if (e.key==='Escape') setOpen(false); }}
      />
      {open && opts.length>0 && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-xl popover text-black dark:text-white">
          {opts.map((o, i)=> (
            <button
              key={i}
              type="button"
              className="block w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
              onMouseDown={(e)=> e.preventDefault()}
              onClick={()=>{ setQ(o.label); setOpen(false); onSelect(o); }}
            >
              <div className="text-sm">{o.label}</div>
              <div className="text-xs opacity-60">{o.lat.toFixed(5)}, {o.lon.toFixed(5)}</div>
            </button>
          ))}
          {loading && <div className="px-3 py-2 text-sm opacity-70">Searching…</div>}
        </div>
      )}
    </div>
  );
}
