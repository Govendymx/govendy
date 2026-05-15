'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  className?: string;
  viewportClassName?: string;
  children: React.ReactNode;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function ScrollArea({ className = '', viewportClassName = '', children }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startY: number; startTop: number; dragging: boolean }>({ startY: 0, startTop: 0, dragging: false });

  const [metrics, setMetrics] = useState({ top: 0, ratio: 1 });

  const thumb = useMemo(() => {
    const viewport = viewportRef.current;
    if (!viewport) return { height: 0, top: 0, hidden: true };
    const { scrollHeight, clientHeight } = viewport;
    const hidden = scrollHeight <= clientHeight + 1;
    const ratio = clientHeight / Math.max(1, scrollHeight);
    const height = clamp(Math.round(clientHeight * ratio), 28, clientHeight);
    const maxTop = Math.max(0, clientHeight - height);
    const top = clamp(Math.round(metrics.top * maxTop), 0, maxTop);
    return { height, top, hidden };
  }, [metrics.top]);

  const sync = () => {
    const el = viewportRef.current;
    if (!el) return;
    const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
    setMetrics({ top: el.scrollTop / maxScroll, ratio: el.clientHeight / Math.max(1, el.scrollHeight) });
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    sync();

    const onScroll = () => sync();
    el.addEventListener('scroll', onScroll, { passive: true });

    const ro = new ResizeObserver(() => sync());
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = viewportRef.current;
      if (!el) return;
      if (!dragRef.current.dragging) return;
      const dy = e.clientY - dragRef.current.startY;
      const track = el.clientHeight;
      const thumbHeight = clamp(Math.round(track * metrics.ratio), 28, track);
      const maxThumbTop = Math.max(1, track - thumbHeight);
      const nextThumbTop = clamp(dragRef.current.startTop + dy, 0, maxThumbTop);
      const nextRatio = nextThumbTop / maxThumbTop;
      el.scrollTop = nextRatio * Math.max(1, el.scrollHeight - el.clientHeight);
    };
    const onUp = () => {
      dragRef.current.dragging = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [metrics.ratio]);

  return (
    <div className={`relative ${className}`}>
      <div ref={viewportRef} className={`h-full w-full overflow-y-auto pr-3 ${viewportClassName}`}>
        {children}
      </div>

      {/* Scrollbar custom (siempre visible) */}
      <div className="pointer-events-none absolute right-1 top-1 bottom-1 w-2 rounded-full bg-black/5" />
      <div
        className="absolute right-1 top-1 bottom-1 w-2"
        onMouseDown={(e) => {
          // permitir arrastrar el thumb
          const el = viewportRef.current;
          if (!el) return;
          dragRef.current.dragging = true;
          dragRef.current.startY = e.clientY;
          dragRef.current.startTop = thumb.top;
          e.preventDefault();
        }}
        style={{ cursor: 'grab' }}
      >
        <div
          className={`pointer-events-auto absolute left-0 w-2 rounded-full bg-black/40 hover:bg-black/55 ${
            thumb.hidden ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ top: thumb.top, height: thumb.height }}
        />
      </div>
    </div>
  );
}

