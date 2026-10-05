'use client';

import { useEffect } from 'react';

/** Registra el service worker de la PWA (instalable y con página sin conexión). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
