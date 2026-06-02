// @vitest-environment jsdom

import { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTypewriter } from '@/hooks/useTypewriter';

function TypewriterProbe({ text }: { text: string }) {
  const { displayedText, isComplete } = useTypewriter(text, 1000);

  return (
    <p data-complete={String(isComplete)} data-testid="typed-text">
      {displayedText}
    </p>
  );
}

describe('useTypewriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('starts typing after React Strict Mode replays the initial effect', () => {
    render(
      <StrictMode>
        <TypewriterProbe text="This is a 9x9 board." />
      </StrictMode>,
    );

    act(() => {
      vi.advanceTimersByTime(5);
    });

    expect(screen.getByTestId('typed-text').textContent).toContain('This');

    act(() => {
      vi.advanceTimersByTime(30);
    });

    expect(screen.getByTestId('typed-text').textContent).toBe('This is a 9x9 board.');
    expect(screen.getByTestId('typed-text').getAttribute('data-complete')).toBe('true');
  });
});
