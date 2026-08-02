'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clampVisibleCount,
  resolveInitialVisibleCount,
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

export default function useClientPagination<T>({
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
