'use client';

import React from 'react';

export interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems?: number;
    pageSize?: number;
}

export function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize = 50 }: PaginationProps) {
    if (totalPages <= 1) return null;

    const from = (currentPage - 1) * pageSize + 1;
    const to = Math.min(currentPage * pageSize, totalItems ?? currentPage * pageSize);

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
        .reduce<(number | string)[]>((acc, p, i, arr) => {
            if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
            acc.push(p);
            return acc;
        }, []);

    return (
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-3 rounded-b-xl">
            <div className="text-xs text-gray-500">
                {totalItems != null ? `${from}–${to} de ${totalItems}` : `Página ${currentPage} de ${totalPages}`}
            </div>
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                    ← Anterior
                </button>
                {pages.map((p, i) =>
                    typeof p === 'string' ? (
                        <span key={`dot-${i}`} className="px-1 text-gray-400">…</span>
                    ) : (
                        <button
                            key={p}
                            onClick={() => onPageChange(p)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${p === currentPage
                                    ? 'bg-purple-600 text-white shadow-md'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                                }`}
                        >
                            {p}
                        </button>
                    )
                )}
                <button
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                >
                    Siguiente →
                </button>
            </div>
        </div>
    );
}

/** Helper hook: returns paginated slice and pagination props */
export function usePagination<T>(items: T[], pageSize = 50) {
    const [currentPage, setCurrentPage] = React.useState(1);
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

    // Clamp page if items shrink
    React.useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [totalPages, currentPage]);

    const paginatedItems = React.useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return items.slice(start, start + pageSize);
    }, [items, currentPage, pageSize]);

    return {
        paginatedItems,
        currentPage,
        totalPages,
        setCurrentPage,
        totalItems: items.length,
        pageSize,
        paginationProps: {
            currentPage,
            totalPages,
            onPageChange: setCurrentPage,
            totalItems: items.length,
            pageSize,
        } satisfies PaginationProps,
    };
}
