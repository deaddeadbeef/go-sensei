"use client";

import { useRef, useState, useEffect } from 'react';
import { GoBoard } from './GoBoard';

export function BoardContainer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(600);

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      // Fill as much space as possible — use the smaller dimension
      const s = Math.floor(Math.min(width, height) - 8);
      setSize(Math.max(s, 300)); // minimum 300px
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current!);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full flex items-center justify-center"
    >
      <div style={{ width: size, height: size }}>
        <GoBoard />
      </div>
    </div>
  );
}
