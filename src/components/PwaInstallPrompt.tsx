"use client";
import { useCallback, useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_WINDOW_HOURS = 24;

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

function isLikelyIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isWebkit = /applewebkit/.test(ua);
  const isChrome = /crios|fxios/.test(ua); // Chrome/Firefox on iOS still WebKit but use install prompt duplicates
  // Safari is the only browser on iOS that supports the "Add to Home Screen" flow we want to explain.
  return isIOS && isWebkit && !isChrome;
}

function isSmallViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 1024px)').matches;
}

export default function PwaInstallPrompt(){
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const dismissedRecently = dismissedAt != null && (Date.now() - dismissedAt) < DISMISS_WINDOW_HOURS * 60 * 60 * 1000;

  const hidePrompt = useCallback(()=>{
    setVisible(false);
    setDeferred(null);
    setShowIosHint(false);
    if (typeof window !== 'undefined'){
      const now = Date.now();
      window.localStorage.setItem(DISMISS_KEY, String(now));
      setDismissedAt(now);
    }
  }, []);

  useEffect(()=>{
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const timestamp = raw ? Number(raw) : NaN;
    if (Number.isFinite(timestamp)){
      setDismissedAt(timestamp);
    }

    const onStorage = (event: StorageEvent)=>{
      if (event.key === DISMISS_KEY && event.newValue){
        const ts = Number(event.newValue);
        if (Number.isFinite(ts)) setDismissedAt(ts);
      }
    };
    window.addEventListener('storage', onStorage);
    return ()=> window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(()=>{
    if (typeof window === 'undefined' || dismissedRecently) return;
    if (!isSmallViewport() || isStandaloneDisplay()) return;

    function handleBeforeInstallPrompt(event: Event){
      const bip = event as BeforeInstallPromptEvent;
      // This event only fires if the browser thinks the app is installable (Chrome/Edge Android, etc.)
      event.preventDefault();
      setDeferred(bip);
      setVisible(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return ()=> window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [dismissedRecently]);

  useEffect(()=>{
    if (typeof window === 'undefined' || dismissedRecently) return;
    if (!isSmallViewport() || isStandaloneDisplay()) return;

    if (isLikelyIosSafari()){
      setShowIosHint(true);
      setVisible(true);
    }
  }, [dismissedRecently]);

  const triggerInstall = useCallback(async()=>{
    if (!deferred) return;
    try{
      await deferred.prompt();
      await deferred.userChoice;
    } finally {
      hidePrompt();
    }
  }, [deferred, hidePrompt]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 md:px-6">
      <div className="max-w-md flex-1 rounded-2xl border border-white/20 bg-white/90 p-4 text-sm shadow-xl backdrop-blur dark:border-white/10 dark:bg-neutral-900/90">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">Install SADD</div>
            <div className="text-xs opacity-70">Add the app to your home screen for faster access and offline notices.</div>
          </div>
          <button type="button" onClick={hidePrompt} aria-label="Dismiss" className="rounded-full p-1 text-xl leading-none opacity-80 hover:opacity-100">×</button>
        </div>
        {deferred ? (
          <button
            type="button"
            onClick={triggerInstall}
            className="w-full rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/80 dark:bg-white dark:text-black"
          >
            Install app
          </button>
        ) : null}
        {showIosHint ? (
          <div className="mt-2 rounded-lg border border-black/10 bg-black/5 px-3 py-2 text-xs text-black dark:border-white/10 dark:bg-white/10 dark:text-white">
            On Safari, tap the share button <span aria-hidden className="mx-1">▵</span> then choose “Add to Home Screen”.
          </div>
        ) : null}
      </div>
    </div>
  );
}
