'use client';
import { useEffect } from 'react';

export default function ScrollRestorer({ storageKey }: { storageKey: string }) {
  useEffect(() => {
    const savedY = sessionStorage.getItem(storageKey);
    if (savedY) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: parseInt(savedY), behavior: 'instant' });
        sessionStorage.removeItem(storageKey);
      });
    }
  }, [storageKey]);
  return null;
}
