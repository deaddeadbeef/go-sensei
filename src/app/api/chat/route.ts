import { streamText, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { GO_MASTER_SYSTEM_PROMPT } from '@/lib/ai/system-prompt';
import { createGoTools, reconstructGame } from '@/lib/ai/tools';
import { getCopilotSession } from '@/lib/ai/copilot-auth';
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

  // Resolve the GitHub token: client header → env var
  const githubToken = req.headers.get('x-github-token') || process.env.GITHUB_TOKEN;

  if (!githubToken) {
    return new Response(
      JSON.stringify({
        error: 'No GitHub token provided. Enter your GitHub token in Settings or set GITHUB_TOKEN in .env.local',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let session;
  try {
    session = await getCopilotSession(githubToken);
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: `Copilot auth failed: ${(err as Error).message}. Make sure your GitHub token has Copilot access.`,
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  console.log('[GoSensei] Copilot session obtained, API URL:', session.apiUrl);

  const copilot = createOpenAI({
    baseURL: session.apiUrl,
    apiKey: session.token,
    headers: {
      'Copilot-Integration-Id': 'vscode-chat',
      'Editor-Version': 'vscode/1.96.0',
      'Editor-Plugin-Version': 'copilot-chat/0.24.0',
      'Openai-Organization': 'github-copilot',
      'Openai-Intent': 'conversation-panel',
      'User-Agent': 'GitHubCopilotChat/0.24.0',
    },
  });

  const modelId = 'gpt-4o';
  console.log('[GoSensei] Calling Copilot API with model:', modelId);
  console.log('[GoSensei] Message count:', messages.length);
  console.log('[GoSensei] Tools:', Object.keys(wrappedTools));

  try {
    const result = streamText({
      model: copilot(modelId),
      system: GO_MASTER_SYSTEM_PROMPT,
      messages,
      tools: wrappedTools,
      stopWhen: stepCountIs(5), // Allow up to 5 tool-call steps per turn
      temperature: 0.7,
    });

    console.log('[GoSensei] Stream started successfully');
    return result.toUIMessageStreamResponse();
  } catch (streamErr) {
    console.error('[GoSensei] streamText error:', streamErr);
    return new Response(
      JSON.stringify({ error: `AI streaming failed: ${(streamErr as Error).message}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
