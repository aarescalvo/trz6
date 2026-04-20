'use client'

import { useState, useMemo, useCallback } from 'react'

interface UsePaginationOptions {
  totalItems?: number
  initialPageSize?: number
}

interface UsePaginationReturn<T> {
  currentPage: number
  pageSize: number
  totalPages: number
  startIndex: number
  endIndex: number
  paginatedData: T[]
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  nextPage: () => void
  prevPage: () => void
}

export function usePagination<T>(
  data: T[],
  options?: UsePaginationOptions
): UsePaginationReturn<T> {
  const initialPageSize = options?.initialPageSize ?? 25

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  // Track the data length we last rendered with. When it changes (new search
  // results, etc.) we reset the page to 1 automatically.
  const [lastDataLength, setLastDataLength] = useState(data.length)

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))

  // Detect data length changes during render and reset page.
  // This is React's "getDerivedStateFromProps" pattern — calling setState
  // conditionally during render is safe as long as it converges (which it
  // does here because we also update lastDataLength so the condition won't
  // re-trigger).
  let effectivePage = currentPage
  if (data.length !== lastDataLength) {
    setLastDataLength(data.length)
    setCurrentPage(1)
    effectivePage = 1
  }
  // Clamp page when total pages shrink (e.g. pageSize increases)
  if (effectivePage > totalPages) {
    setCurrentPage(totalPages)
    effectivePage = totalPages
  }

  const startIndex = (effectivePage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, data.length)

  const paginatedData = useMemo(() => {
    return data.slice(startIndex, endIndex)
  }, [data, startIndex, endIndex])

  const setPage = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)))
    },
    [totalPages]
  )

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size)
    setCurrentPage(1)
  }, [])

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }, [])

  return {
    currentPage: effectivePage,
    pageSize,
    totalPages,
    startIndex,
    endIndex,
    paginatedData,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
  }
}
