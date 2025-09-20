import * as Sentry from '@sentry/nextjs';

export function captureError(error: unknown, context?: Record<string, unknown>){
  try{
    // captureException is a no-op if Sentry not initialized
    Sentry.captureException(error, { extra: context });
  }catch{
    // ignore
  }
}

