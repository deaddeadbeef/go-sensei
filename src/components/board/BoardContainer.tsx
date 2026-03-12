"use client";

import { useRef, useState, useEffect } from 'react';
import { GoBoard } from './GoBoard';

export function BoardContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(500);

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      // Use almost all available space — no arbitrary cap
      setSize(Math.min(width - 16, height - 16));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 flex items-center justify-center"
    >
      <div style={{ width: size, height: size }}>
        <GoBoard />
      </div>
    </div>
  );
}
