"use client";
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type AnchorRect = { top:number; left:number; right:number; bottom:number; width:number; height:number } | null;

export default function Dropdown({ open, anchor, onClose, children }:{ open:boolean; anchor: AnchorRect; onClose:()=>void; children:React.ReactNode }){
  const [mounted, setMounted] = useState(false);
  useEffect(()=>{ setMounted(true); return ()=> setMounted(false); },[]);
  useEffect(()=>{
    if (!open) return;
    const onKey = (e: KeyboardEvent)=>{ if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return ()=> window.removeEventListener('keydown', onKey);
  },[open,onClose]);
  if (!mounted || !open || !anchor) return null;

  const top = anchor.bottom + 8 + window.scrollY;
  const right = window.innerWidth - anchor.right - 4; // align to button right edge

  return createPortal(
    <div className="fixed inset-0 z-[1500]" onClick={onClose}>
      <div className="absolute" style={{ top, right }} onClick={(e)=> e.stopPropagation()}>
        <div className="w-56 rounded-xl popover">
          {children}
        </div>
      </div>
    </div>, document.body);
}
