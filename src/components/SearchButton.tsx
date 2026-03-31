'use client';

import { useState } from 'react';
import SearchOverlay from './SearchOverlay';

export default function SearchButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="검색"
        className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-all duration-200"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
      <SearchOverlay
        isOpen={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
