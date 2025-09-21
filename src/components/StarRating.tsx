"use client";
import { useState } from 'react';

export default function StarRating({ value=0, onChange }: { value?: number; onChange?: (v:number)=>void }){
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="flex items-center gap-1" onMouseLeave={()=> setHover(0)}>
      {[1,2,3,4,5].map(n=> (
        <button key={n} type="button" aria-label={`${n} star`} onMouseEnter={()=> setHover(n)} onClick={()=> onChange?.(n)} className="text-2xl">
          <span className={display>=n ? 'text-yellow-500' : 'text-gray-400'}>★</span>
        </button>
      ))}
    </div>
  );
}

