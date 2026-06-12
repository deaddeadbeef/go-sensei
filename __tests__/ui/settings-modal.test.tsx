// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsModal } from '@/components/ui/SettingsModal';

describe('SettingsModal auth fallback', () => {
  afterEach(() => cleanup());

  it('lets learners start guided practice after a sign-in error', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <SettingsModal
        isOpen
        onClose={onClose}
        onSave={onSave}
        currentBoardSize={19}
        currentTeachingLevel="beginner"
        isLoggedIn={false}
        authState={{
          status: 'error',
          userCode: null,
          verificationUri: null,
          error: 'GitHub sign-in is not configured for this deployment yet. You can still use guided lessons, problems, and local coaching without signing in.',
        }}
        onLogin={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByText(/GitHub sign-in is not configured/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start guided practice' }));

    expect(onSave).toHaveBeenCalledWith({ boardSize: 9, teachingLevel: 'guided' });
    expect(onClose).toHaveBeenCalled();
  });
});
