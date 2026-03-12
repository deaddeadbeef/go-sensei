import { streamText, stepCountIs } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { GO_MASTER_SYSTEM_PROMPT } from '@/lib/ai/system-prompt';
import { createGoTools, reconstructGame } from '@/lib/ai/tools';
import { createGame, playMove } from '@/lib/go-engine';
import type { GameState } from '@/lib/go-engine/types';

export const maxDuration = 60; // Allow up to 60 seconds for AI response

export async function POST(req: Request) {
  const { messages, gameState: gameStateData } = await req.json();

  // Reconstruct game state from the client-provided move history
  let gameState: GameState;
  if (gameStateData?.moveHistory) {
    gameState = reconstructGame(
      gameStateData.moveHistory,
      gameStateData.boardSize || 9,
      gameStateData.komi || 6.5,
    );
  } else {
    gameState = createGame(9, 6.5);
  }

  // Mutable reference — updated when make_move executes so subsequent
  // tool calls within the same turn see the latest board.
  let currentState = gameState;
  const tools = createGoTools(() => currentState);

  // Wrap make_move to keep currentState in sync after a successful play
  const wrappedTools = {
    ...tools,
    make_move: {
      ...tools.make_move,
      execute: async (args: { x: number; y: number; reasoning: string }) => {
        const result = await tools.make_move.execute!(args, {
          toolCallId: '',
          messages: [],
        });
        if (result && 'success' in result && result.success) {
          const moveResult = playMove(currentState, { x: args.x, y: args.y });
          if (moveResult.success) {
            currentState = moveResult.newState;
          }
        }
        return result;
      },
    },
  };

  // Resolve the API key: client header → env var
  const apiKey = req.headers.get('x-api-key') || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'No API key provided. Set ANTHROPIC_API_KEY in .env.local or provide via settings.',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const anthropic = createAnthropic({ apiKey });

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: GO_MASTER_SYSTEM_PROMPT,
    messages,
    tools: wrappedTools,
    stopWhen: stepCountIs(5), // Allow up to 5 tool-call steps per turn
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse();
}
