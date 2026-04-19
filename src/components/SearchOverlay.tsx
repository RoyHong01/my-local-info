'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import Fuse from 'fuse.js';

interface SearchItem {
  id: string;
  title: string;
  summary: string;
  category: string;
  href: string;
  tags: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  '인천시 정보': 'bg-blue-50 text-blue-600',
  '전국 보조금·복지': 'bg-orange-50 text-orange-600',
  '전국 축제·여행': 'bg-purple-50 text-purple-600',
  '블로그': 'bg-green-50 text-green-600',
  '픽앤조이 초이스': 'bg-amber-50 text-amber-600',
  '픽앤조이 맛집 탐방': 'bg-red-50 text-red-600',
};

function getCategoryColor(category: string) {
  for (const [key, value] of Object.entries(CATEGORY_COLORS)) {
    if (category.includes(key) || key.includes(category)) return value;
  }
  return 'bg-stone-50 text-stone-600';
}

export default function SearchOverlay({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchItem[]>([]);
  const fuseRef = useRef<Fuse<SearchItem> | null>(null);
  const [ready, setReady] = useState(false);
  const fetchedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 인덱스 로드 (최초 오픈 시 1회)
  useEffect(() => {
    if (!isOpen || fetchedRef.current) return;
    fetchedRef.current = true;
    fetch('/data/search-index.json')
      .then((res) => res.json())
      .then((data: SearchItem[]) => {
        fuseRef.current = new Fuse(data, {
          keys: [
            { name: 'title', weight: 0.5 },
            { name: 'summary', weight: 0.25 },
            { name: 'tags', weight: 0.15 },
            { name: 'category', weight: 0.1 },
          ],
          threshold: 0.35,
          includeScore: true,
          minMatchCharLength: 1,
        });
        setReady(true);
      })
      .catch(() => { /* ignore */ });
  }, [isOpen]);

  // 포커스
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // ESC 닫기
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // 검색
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (!fuseRef.current || value.trim().length === 0) {
        setResults([]);
        return;
      }
      const raw = fuseRef.current.search(value, { limit: 15 });
      setResults(raw.map((r) => r.item));
    },
    [],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Search panel */}
      <div className="relative w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-400 shrink-0">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="보조금, 축제, 맛집 등 검색어를 입력하세요"
            className="flex-1 text-base sm:text-lg text-stone-800 placeholder:text-stone-400 outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-xs font-medium text-stone-400 bg-stone-100 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {!ready && (
            <div className="py-12 text-center text-stone-400 text-sm">검색 인덱스 로딩 중…</div>
          )}

          {ready && query.length > 0 && results.length === 0 && (
            <div className="py-12 text-center text-stone-400 text-sm">
              &quot;{query}&quot;에 대한 검색 결과가 없습니다
            </div>
          )}

          {results.length > 0 && (
            <ul className="py-2">
              {results.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className="flex flex-col gap-1 px-5 py-3 hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${getCategoryColor(item.category)}`}>
                        {item.category}
                      </span>
                      <span className="text-sm font-bold text-stone-800 line-clamp-1">{item.title}</span>
                    </div>
                    {item.summary && (
                      <p className="text-xs text-stone-500 line-clamp-1 pl-0.5">{item.summary}</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {ready && query.length === 0 && (
            <div className="py-10 text-center text-stone-400 text-sm">
              보조금, 축제, 맛집 등 원하는 키워드를 입력해보세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
