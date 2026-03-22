"use client";

import { useRef, useState, useEffect } from 'react';
import { GoBoard } from './GoBoard';

export function BoardContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const s = Math.floor(Math.min(rect.width, rect.height) - 8);
      setSize(Math.max(s, 300));
    };

    // Use ResizeObserver for responsive updates
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);

    // Also run on next frame to get correct layout dimensions
    requestAnimationFrame(updateSize);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ flex: '1 1 0%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      <div style={{ width: size, height: size, position: 'relative' }}>
        <GoBoard />
      </div>
    </div>
  );
}
