"use client";
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  zIndex?: number;
};

export default function Modal({ open, onClose, children, zIndex = 2000 }: ModalProps){
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(()=>{
    if (!open) return;
    // Create a host element for the portal
    const el = document.createElement('div');
    el.setAttribute('data-modal-root','');
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.zIndex = String(zIndex);
    document.body.appendChild(el);
    containerRef.current = el as unknown as HTMLElement;
    // Lock background scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return ()=>{
      document.body.style.overflow = prevOverflow;
      el.remove();
      containerRef.current = null;
    };
  },[open, zIndex]);

  if (!open || !containerRef.current) return null;

  return createPortal(
    <div className="fixed inset-0 min-h-[100dvh]">
      {/* Dim overlay (no blur here so only the panel area blurs) */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="w-full max-w-xl max-h-[85dvh] overflow-y-auto rounded-2xl glass border backdrop-blur-[10px]" style={{ backdropFilter: 'blur(10px) saturate(150%)', WebkitBackdropFilter: 'blur(10px) saturate(150%)' }}>
          {children}
        </div>
      </div>
    </div>,
    containerRef.current
  );
}

