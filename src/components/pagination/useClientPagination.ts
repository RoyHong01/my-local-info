'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  buildPageNumbers,
  clampPage,
  clampVisibleCount,
  resolveInitialVisibleCount,
  resolveTotalPages,
} from './pagination-core.js';

type PaginationItem = unknown;

export interface UseClientPaginationInput<T = PaginationItem> {
  items: T[];
  pageSize: number;
  scopeKey: string;
}

export interface UseClientPaginationResult<T = PaginationItem> {
  visibleItems: T[];
  visibleCount: number;
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
  ensureVisible: (indexOrCount: number) => void;
}

export function useClientPagination<T>({
  items,
  pageSize,
  scopeKey,
}: UseClientPaginationInput<T>): UseClientPaginationResult<T> {
  const safePageSize = Math.max(1, Math.floor(Number(pageSize) || 1));
  const totalCount = items.length;

  const [visibleCount, setVisibleCount] = useState(() =>
    resolveInitialVisibleCount(totalCount, safePageSize)
  );

  useEffect(() => {
    setVisibleCount(resolveInitialVisibleCount(totalCount, safePageSize));
  }, [scopeKey, totalCount, safePageSize]);

  const loadMore = useCallback(() => {
    setVisibleCount((current) => clampVisibleCount(totalCount, current + safePageSize));
  }, [totalCount, safePageSize]);

  const reset = useCallback(() => {
    setVisibleCount(resolveInitialVisibleCount(totalCount, safePageSize));
  }, [totalCount, safePageSize]);

  const ensureVisible = useCallback((indexOrCount: number) => {
    const requested = Math.max(0, Math.floor(Number(indexOrCount) || 0));
    if (requested <= 0) return;
    setVisibleCount((current) => clampVisibleCount(totalCount, Math.max(current, requested)));
  }, [totalCount]);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  );

  return {
    visibleItems,
    visibleCount,
    hasMore: visibleCount < totalCount,
    loadMore,
    reset,
    ensureVisible,
  };
}

export function usePagedList<T>(items: T[], pageSize: number) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawPage = Number(searchParams.get('page') || '1');
  const totalPages = resolveTotalPages(items.length, pageSize);
  const currentPage = clampPage(rawPage, items.length, pageSize);

  const start = (currentPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  const pageNumbers = buildPageNumbers(currentPage, totalPages);

  const goTo = useCallback((page: number) => {
    const next = clampPage(page, items.length, pageSize);
    const params = new URLSearchParams(searchParams.toString());
    if (next <= 1) params.delete('page');
    else params.set('page', String(next));
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [items.length, pageSize, pathname, router, searchParams]);

  return {
    pageItems,
    currentPage,
    totalPages,
    totalCount: items.length,
    pageNumbers,
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
    goTo,
  };
}

export default useClientPagination;
