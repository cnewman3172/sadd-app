"use client";
import { useCallback, useEffect, useState } from 'react';
import { showToast } from '@/components/Toast';

export type CurrentUser = {
  id: string;
  firstName?: string;
  lastName?: string;
  role?: 'ADMIN' | 'DISPATCHER' | 'TC' | 'DRIVER' | 'SAFETY' | 'RIDER';
};

export type UseCurrentUserResult = {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => void;
};

export default function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/me', { cache: 'no-store' });
      const data = response.ok ? await response.json() : null;
      setUser(data as CurrentUser | null);
      try {
        const prev = window.localStorage.getItem('sadd_role');
        if (data?.role) {
          if (prev && prev !== data.role) {
            showToast('Permissions updated');
          }
          window.localStorage.setItem('sadd_role', data.role);
        } else if (prev) {
          window.localStorage.removeItem('sadd_role');
        }
      } catch {
        // ignore storage errors
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await load();
      if (!active) {
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [load]);

  return { user, loading, refresh: load };
}
