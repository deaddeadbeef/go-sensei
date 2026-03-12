"use client";

import { useRef, useState, useEffect } from 'react';
import { GoBoard } from './GoBoard';

export function BoardContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(500);

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      setBoardSize(Math.min(width, height, 600));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center relative"
      style={{ padding: 16 }}
    >
      <div style={{ width: boardSize, height: boardSize }}>
        <GoBoard />
      </div>
    </div>
  );
}
