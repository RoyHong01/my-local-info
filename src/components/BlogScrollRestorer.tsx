'use client';
import { useEffect } from 'react';

export default function BlogScrollRestorer() {
  useEffect(() => {
    const savedY = sessionStorage.getItem('blogScrollY');
    if (savedY) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: parseInt(savedY), behavior: 'instant' });
        sessionStorage.removeItem('blogScrollY');
      });
    }
  }, []);

  return null;
}
