import { z } from 'zod';
import { tool } from 'ai';
import {
  createGame,
  playMove,
  passMove,
  isValidMove,
  getGroup,
  getLibertiesOf,
  countLiberties,
  boardToText,
} from '@/lib/go-engine';
import type { GameState, Point } from '@/lib/go-engine/types';

/**
 * Reconstructs a GameState by replaying a move history from scratch.
 * Used to rebuild server-side state from the client-provided move list.
 */
export function reconstructGame(
  moves: { type: string; x?: number; y?: number; color?: string }[],
  size: 9 | 13 | 19 = 9,
  komi: number = 6.5,
): GameState {
  let game = createGame(size, komi);
  for (const move of moves) {
    if (move.type === 'place' && move.x !== undefined && move.y !== undefined) {
      const result = playMove(game, { x: move.x, y: move.y });
      if (result.success) game = result.newState;
    } else if (move.type === 'pass') {
      game = passMove(game);
    }
  }
  return game;
}

/**
 * Creates the full set of Go teaching tools for use with streamText.
 * Each tool receives the current game state via the `getGameState` closure.
 */
export function createGoTools(getGameState: () => GameState) {
  return {
    make_move: tool({
      description:
        'Place a stone on the board at the given coordinates. This is YOUR move. The move will be validated by the game engine. If invalid, you will receive an error — try a different move.',
      inputSchema: z.object({
        x: z.number().int().min(0).describe('Column index, 0-indexed from left (A=0, B=1, ...)'),
        y: z.number().int().min(0).describe('Row index, 0-indexed from top'),
        reasoning: z.string().describe('Brief reasoning for this move (shown to the student as teaching)'),
      }),
      execute: async ({ x, y, reasoning }) => {
        const game = getGameState();
        const point: Point = { x, y };

        if (!isValidMove(game, point)) {
          return {
            success: false as const,
            error: `Invalid move at (${x}, ${y}). The position may be occupied, off the board, a ko point, or suicide.`,
          };
        }

        const result = playMove(game, point);
        if (!result.success) {
          return { success: false as const, error: result.reason };
        }

        return {
          success: true as const,
          move: { x, y },
          reasoning,
          captured: result.captured,
          capturedCount: result.captured.length,
          newBoardText: boardToText(result.newState),
        };
      },
    }),

    pass_turn: tool({
      description:
        'Pass your turn. Use when you believe the game should move to scoring, or to demonstrate passing. Two consecutive passes end the game.',
      inputSchema: z.object({
        reasoning: z.string().describe('Why you are passing'),
      }),
      execute: async ({ reasoning }) => {
        const game = getGameState();
        const newState = passMove(game);
        return {
          success: true as const,
          reasoning,
          consecutivePasses: newState.consecutivePasses,
          phase: newState.phase,
        };
      },
    }),

    resign_game: tool({
      description:
        'Resign the game. Use sparingly — only when the student has clearly won and continuing would not be educational.',
      inputSchema: z.object({
        message: z.string().describe('Congratulatory message to the student'),
      }),
      execute: async ({ message }) => {
        return { success: true as const, message };
      },
    }),

    highlight_positions: tool({
      description:
        'Highlight specific board positions to visually teach the student. Highlights appear as colored overlays. Use to show: groups in danger, good moves, territory, etc.',
      inputSchema: z.object({
        positions: z
          .array(
            z.object({
              x: z.number().int(),
              y: z.number().int(),
            }),
          )
          .describe('Board positions to highlight'),
        style: z
          .enum(['positive', 'warning', 'danger', 'neutral'])
          .describe('Visual style: positive=green glow, warning=amber pulse, danger=red pulse, neutral=blue'),
        label: z.string().optional().describe('Optional label shown near the highlights'),
      }),
      execute: async ({ positions, style, label }) => {
        return { positions, style, label };
      },
    }),

    show_liberty_count: tool({
      description:
        'Highlight a group of connected stones and show its liberty count. Great for teaching about liberties, atari, and capture threats.',
      inputSchema: z.object({
        x: z.number().int().describe('X coordinate of any stone in the group'),
        y: z.number().int().describe('Y coordinate of any stone in the group'),
      }),
      execute: async ({ x, y }) => {
        const game = getGameState();
        const group = getGroup(game.board, { x, y });
        if (!group) {
          return { success: false as const, error: `No stone at (${x}, ${y})` };
        }
        const liberties = getLibertiesOf(game.board, { x, y });
        const count = countLiberties(game.board, { x, y });
        return {
          success: true as const,
          group: group.stones,
          liberties,
          count,
          isAtari: count === 1,
        };
      },
    }),

    suggest_moves: tool({
      description:
        'Show the student 1-3 suggested next moves with explanations. Use when asked for help or when the student seems stuck.',
      inputSchema: z.object({
        suggestions: z
          .array(
            z.object({
              x: z.number().int(),
              y: z.number().int(),
              label: z.string().describe('Short label like "A" or "Best"'),
              reason: z.string().describe('Why this move is good, in beginner-friendly language'),
            }),
          )
          .min(1)
          .max(3),
      }),
      execute: async ({ suggestions }) => {
        return { suggestions };
      },
    }),

    start_lesson: tool({
      description:
        'Begin an interactive teaching moment. Pauses the game and demonstrates a Go concept on the board with example stones and step-by-step explanation.',
      inputSchema: z.object({
        title: z.string().describe('Lesson title, e.g., "The Ladder"'),
        concept: z.string().describe('The concept being taught'),
        steps: z.array(z.string()).describe('Step-by-step teaching text'),
      }),
      execute: async ({ title, concept, steps }) => {
        return { title, concept, steps, totalSteps: steps.length };
      },
    }),

    replay_sequence: tool({
      description:
        'Show a sequence of previous moves replayed on the board to explain what happened. Used to review captures, mistakes, or patterns.',
      inputSchema: z.object({
        moves: z.array(
          z.object({
            x: z.number().int(),
            y: z.number().int(),
            color: z.enum(['black', 'white']),
            label: z.string().optional().describe('e.g., "①" or "This was the key move"'),
          }),
        ),
        explanation: z.string().describe('What this sequence demonstrates'),
      }),
      execute: async ({ moves, explanation }) => {
        return { moves, explanation };
      },
    }),
  };
}
