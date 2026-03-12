"use client";
import { useState } from 'react';
import { COLORS } from '@/utils/colors';
import { motion, AnimatePresence } from 'framer-motion';
import type { BoardSize } from '@/lib/go-engine/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: { boardSize: BoardSize }) => void;
  currentBoardSize: BoardSize;
  // Auth props from useGitHubAuth
  isLoggedIn: boolean;
  authState: {
    status: string;
    userCode: string | null;
    verificationUri: string | null;
    error: string | null;
  };
  onLogin: () => void;
  onLogout: () => void;
}

export function SettingsModal({
  isOpen, onClose, onSave, currentBoardSize,
  isLoggedIn, authState, onLogin, onLogout,
}: SettingsModalProps) {
  const [boardSize, setBoardSize] = useState<BoardSize>(currentBoardSize);

  const handleSave = () => {
    onSave({ boardSize });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />
          <motion.div
            className="relative z-10 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl"
            style={{ backgroundColor: COLORS.ui.bgCard }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: COLORS.ui.accent }}>
              ⚙ Settings
            </h2>

            {/* GitHub Auth Section */}
            <div className="mb-5">
              <label className="block text-xs mb-2" style={{ color: COLORS.ui.textSecondary }}>
                GitHub Copilot
              </label>

              {isLoggedIn ? (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                  style={{ backgroundColor: COLORS.ui.bgPrimary }}>
                  <span className="text-sm flex items-center gap-2" style={{ color: COLORS.overlay.positive }}>
                    ✓ Connected to GitHub
                  </span>
                  <button
                    onClick={onLogout}
                    className="text-xs px-2 py-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                    style={{ color: COLORS.ui.textSecondary }}
                  >
                    Logout
                  </button>
                </div>
              ) : authState.status === 'awaiting_user' || authState.status === 'polling' ? (
                <div className="px-3 py-3 rounded-lg text-center"
                  style={{ backgroundColor: COLORS.ui.bgPrimary }}>
                  <p className="text-xs mb-2" style={{ color: COLORS.ui.textSecondary }}>
                    Enter this code at GitHub:
                  </p>
                  <p className="text-2xl font-mono font-bold tracking-widest mb-2"
                    style={{ color: COLORS.ui.accent }}>
                    {authState.userCode || '...'}
                  </p>
                  <a
                    href={authState.verificationUri || 'https://github.com/login/device'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                    style={{ color: COLORS.ui.accent }}
                  >
                    github.com/login/device ↗
                  </a>
                  <p className="text-xs mt-2 animate-pulse" style={{ color: COLORS.ui.textSecondary }}>
                    Waiting for authorization...
                  </p>
                </div>
              ) : (
                <div>
                  <button
                    onClick={onLogin}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:brightness-110"
                    style={{ backgroundColor: '#24292f', color: '#ffffff' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    Login with GitHub
                  </button>
                  {authState.error && (
                    <p className="text-xs mt-2" style={{ color: COLORS.overlay.danger }}>
                      {authState.error}
                    </p>
                  )}
                  <p className="text-xs mt-2 opacity-50" style={{ color: COLORS.ui.textSecondary }}>
                    Requires a GitHub Copilot subscription
                  </p>
                </div>
              )}
            </div>

            {/* Board Size */}
            <div className="mb-6">
              <label className="block text-xs mb-2" style={{ color: COLORS.ui.textSecondary }}>
                Board Size
              </label>
              <div className="flex gap-2">
                {([9, 13, 19] as BoardSize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => setBoardSize(size)}
                    className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: boardSize === size ? COLORS.ui.accent : COLORS.ui.bgPrimary,
                      color: boardSize === size ? COLORS.ui.bgPrimary : COLORS.ui.textSecondary,
                      border: `1px solid ${boardSize === size ? COLORS.ui.accent : COLORS.ui.textSecondary + '30'}`,
                    }}
                  >
                    {size}×{size}
                  </button>
                ))}
              </div>
              <p className="text-xs mt-1 opacity-50" style={{ color: COLORS.ui.textSecondary }}>
                19×19 is the standard board size
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm"
                style={{ color: COLORS.ui.textSecondary }}>
                Cancel
              </button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}>
                Save
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
