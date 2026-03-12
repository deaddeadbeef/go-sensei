"use client";
import { useState, useEffect } from 'react';
import { COLORS } from '@/utils/colors';
import { motion, AnimatePresence } from 'framer-motion';
import type { BoardSize } from '@/lib/go-engine/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: { apiKey: string; boardSize: BoardSize }) => void;
  currentBoardSize: BoardSize;
}

export function SettingsModal({ isOpen, onClose, onSave, currentBoardSize }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [boardSize, setBoardSize] = useState<BoardSize>(currentBoardSize);

  useEffect(() => {
    const saved = localStorage.getItem('go-sensei-github-token');
    if (saved) setApiKey(saved);
  }, [isOpen]);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('go-sensei-github-token', apiKey.trim());
    }
    onSave({ apiKey: apiKey.trim(), boardSize });
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
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />

          {/* Modal */}
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

            {/* GitHub Token */}
            <div className="mb-4">
              <label className="block text-xs mb-1" style={{ color: COLORS.ui.textSecondary }}>
                GitHub Token
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="ghp_... or github_pat_..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{
                  backgroundColor: COLORS.ui.bgPrimary,
                  color: COLORS.ui.textPrimary,
                  border: `1px solid ${COLORS.ui.textSecondary}30`,
                }}
              />
              <p className="text-xs mt-1 opacity-50" style={{ color: COLORS.ui.textSecondary }}>
                Create a fine-grained PAT at{' '}
                <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noopener noreferrer"
                  className="underline">github.com/settings/personal-access-tokens</a>{' '}
                with &quot;Copilot&quot; permission. Requires a GitHub Copilot subscription.
              </p>
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
                9×9 recommended for beginners
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ color: COLORS.ui.textSecondary }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: COLORS.ui.accent, color: COLORS.ui.bgPrimary }}
              >
                Save
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
