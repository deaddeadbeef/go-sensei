"use client";
import { useState, useEffect, useRef } from 'react';
import { BUBBLE_TYPEWRITER_SPEED } from '@/utils/animation';

export function useTypewriter(text: string, speed: number = BUBBLE_TYPEWRITER_SPEED) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const indexRef = useRef(0);
  const prevTextRef = useRef('');

  useEffect(() => {
    if (text === prevTextRef.current) return;

    // If new text extends old text, continue from current position
    if (text.startsWith(prevTextRef.current)) {
      indexRef.current = prevTextRef.current.length;
    } else {
      indexRef.current = 0;
      setDisplayedText('');
    }

    prevTextRef.current = text;
    setIsTyping(true);

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        indexRef.current++;
        setDisplayedText(text.slice(0, indexRef.current));
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayedText, isTyping, isComplete: displayedText === text };
}
