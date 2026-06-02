"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { BUBBLE_TYPEWRITER_SPEED } from '@/utils/animation';

export function useTypewriter(text: string, speed: number = BUBBLE_TYPEWRITER_SPEED) {
  const [displayedText, setDisplayedTextState] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const indexRef = useRef(0);
  const prevTextRef = useRef('');
  const displayedTextRef = useRef('');

  const setDisplayedText = useCallback((nextText: string) => {
    displayedTextRef.current = nextText;
    setDisplayedTextState(nextText);
  }, []);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const previousText = prevTextRef.current;
    const currentDisplayedText = displayedTextRef.current;

    if (text === previousText && currentDisplayedText === text) return;

    if (!text) {
      prevTextRef.current = '';
      indexRef.current = 0;
      displayedTextRef.current = '';
      timers.push(setTimeout(() => setDisplayedText(''), 0));
      timers.push(setTimeout(() => setIsTyping(false), 0));
      return () => {
        for (const timer of timers) clearTimeout(timer);
      };
    }

    // If new text extends old text, continue from current position
    if (text.startsWith(previousText)) {
      indexRef.current = Math.min(currentDisplayedText.length, text.length);
    } else {
      indexRef.current = 0;
      timers.push(setTimeout(() => setDisplayedText(''), 0));
    }

    prevTextRef.current = text;
    timers.push(setTimeout(() => setIsTyping(true), 0));

    const interval = setInterval(() => {
      if (indexRef.current < text.length) {
        indexRef.current++;
        setDisplayedText(text.slice(0, indexRef.current));
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 1000 / speed);

    return () => {
      for (const timer of timers) clearTimeout(timer);
      clearInterval(interval);
    };
  }, [text, speed, setDisplayedText]);

  return { displayedText, isTyping, isComplete: displayedText === text };
}
