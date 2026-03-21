import { NextResponse } from 'next/server';
import { getCopilotSession } from '@/lib/ai/copilot-auth';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import type { TeachingLevel } from '@/lib/ai/system-prompt';
import { reconstructGame } from '@/lib/ai/tools';
import {
  createGame, playMove, passMove, isValidMove,
  getGroup, getLibertiesOf, countLiberties, boardToText,
} from '@/lib/go-engine';
import type { GameState, Point } from '@/lib/go-engine/types';

export const maxDuration = 60;

const MODEL = 'gpt-5.4';

// Responses API tool format — flat, NOT nested under a "function" key
const TOOLS = [
  {
    type: 'function' as const,
    name: 'make_move',
    description: 'Place a stone on the board. Validated by the game engine.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Column index, 0-indexed from left' },
        y: { type: 'number', description: 'Row index, 0-indexed from top' },
        reasoning: { type: 'string', description: 'Brief reasoning shown to student' },
      },
      required: ['x', 'y', 'reasoning'],
    },
  },
  {
    type: 'function' as const,
    name: 'pass_turn',
    description: 'Pass your turn. Two consecutive passes end the game.',
    parameters: {
      type: 'object',
      properties: {
        reasoning: { type: 'string', description: 'Why you are passing' },
      },
      required: ['reasoning'],
    },
  },
  {
    type: 'function' as const,
    name: 'highlight_positions',
    description: 'Highlight board positions to teach the student visually.',
    parameters: {
      type: 'object',
      properties: {
        positions: {
          type: 'array',
          items: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' } },
            required: ['x', 'y'],
          },
        },
        style: { type: 'string', enum: ['positive', 'warning', 'danger', 'neutral'] },
        label: { type: 'string' },
      },
      required: ['positions', 'style'],
    },
  },
  {
    type: 'function' as const,
    name: 'show_liberty_count',
    description: "Show a group's liberty count on the board.",
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X of any stone in the group' },
        y: { type: 'number', description: 'Y of any stone in the group' },
      },
      required: ['x', 'y'],
    },
  },
  {
    type: 'function' as const,
    name: 'suggest_moves',
    description: 'Show 1-3 suggested moves to the student.',
    parameters: {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              label: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['x', 'y', 'label', 'reason'],
          },
        },
      },
      required: ['suggestions'],
    },
  },
];

function executeTool(
  name: string,
  args: Record<string, any>,
  state: GameState,
): { result: Record<string, any>; newState?: GameState } {
  switch (name) {
    case 'make_move': {
      const pt: Point = { x: args.x, y: args.y };
      if (!isValidMove(state, pt)) {
        return { result: { success: false, error: `Invalid move at (${args.x},${args.y})` } };
      }
      const r = playMove(state, pt);
      if (!r.success) return { result: { success: false, error: r.reason } };
      return {
        result: {
          success: true,
          move: { x: args.x, y: args.y },
          reasoning: args.reasoning,
          captured: r.captured,
          capturedCount: r.captured.length,
          newBoardText: boardToText(r.newState),
        },
        newState: r.newState,
      };
    }
    case 'pass_turn': {
      const newState = passMove(state);
      return { result: { success: true, reasoning: args.reasoning, phase: newState.phase }, newState };
    }
    case 'highlight_positions':
      return { result: { positions: args.positions, style: args.style, label: args.label } };
    case 'show_liberty_count': {
      const g = getGroup(state.board, { x: args.x, y: args.y });
      if (!g) return { result: { success: false, error: `No stone at (${args.x},${args.y})` } };
      return {
        result: {
          success: true,
          group: g.stones,
          liberties: getLibertiesOf(state.board, { x: args.x, y: args.y }),
          count: countLiberties(state.board, { x: args.x, y: args.y }),
        },
      };
    }
    case 'suggest_moves':
      return { result: { suggestions: args.suggestions } };
    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}

/* ── Responses API helpers ── */

async function callResponses(apiUrl: string, token: string, body: Record<string, any>) {
  console.log('[GoSensei] POST /responses, model:', body.model, 'input items:', Array.isArray(body.input) ? body.input.length : 1);

  const resp = await fetch(`${apiUrl}/responses`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Copilot-Integration-Id': 'vscode-chat',
      'Editor-Version': 'vscode/1.96.0',
      'Editor-Plugin-Version': 'copilot-chat/0.24.0',
      'Openai-Organization': 'github-copilot',
      'Openai-Intent': 'conversation-panel',
      'User-Agent': 'GitHubCopilotChat/0.24.0',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Copilot API ${resp.status}: ${txt.slice(0, 500)}`);
  }
  return resp.json();
}

/** Extract assistant text from a Responses API output array */
function extractText(output: any[]): string {
  const parts: string[] = [];
  for (const item of output) {
    if (item.type === 'message' && item.content) {
      for (const c of item.content) {
        if (c.type === 'output_text' && c.text) parts.push(c.text);
      }
    }
  }
  return parts.join('\n');
}

/** Extract function_call items from a Responses API output array */
function extractFunctionCalls(output: any[]): { id: string; callId: string; name: string; arguments: string }[] {
  return output
    .filter((item: any) => item.type === 'function_call')
    .map((item: any) => ({
      id: item.id || '',
      callId: item.call_id || item.id || '',
      name: item.name,
      arguments: item.arguments,
    }));
}

export async function POST(req: Request) {
  try {
    const { message, gameState: gsData, chatHistory = [] } = await req.json();

    // S3: Sanitize chat history — only allow user/assistant roles with string content
    const sanitizedHistory = (chatHistory as any[])
      .filter((msg: any) =>
        msg && typeof msg === 'object' &&
        (msg.role === 'user' || msg.role === 'assistant') &&
        typeof msg.content === 'string'
      )
      .map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: (msg.content as string).slice(0, 10_000),
      }));

    // A2: Validate boardSize and komi
    const boardSize = [9, 13, 19].includes(gsData?.boardSize) ? gsData.boardSize : 9;
    const komi = typeof gsData?.komi === 'number' ? Math.min(Math.max(gsData.komi, 0), 100) : 6.5;

    const validLevels: TeachingLevel[] = ['beginner', 'intermediate', 'advanced'];
    const teachingLevel: TeachingLevel = validLevels.includes(gsData?.teachingLevel) ? gsData.teachingLevel : 'beginner';

    // A3: Reconstruct game state, return 400 on invalid move history
    let state: GameState;
    try {
      if (gsData?.moveHistory) {
        state = reconstructGame(gsData.moveHistory, boardSize, komi);
      } else {
        state = createGame(9, 6.5);
      }
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid game state: move history could not be replayed.' },
        { status: 400 },
      );
    }

    const ghToken = req.headers.get('x-github-token') || process.env.GITHUB_TOKEN;
    if (!ghToken) {
      return NextResponse.json({ error: 'No GitHub token. Login via Settings.' }, { status: 401 });
    }

    const session = await getCopilotSession(ghToken);
    console.log('[GoSensei] Session OK, API:', session.apiUrl, 'Model:', MODEL);

    // Build input array for Responses API (system prompt goes into `instructions`)
    const input: any[] = [
      ...sanitizedHistory.slice(-20),
      { role: 'user', content: message },
    ];

    const isReviewRequest = typeof message === 'string' && message.includes('GAME REVIEW REQUEST');

    // Agentic loop — up to 5 tool-call rounds
    const toolResults: any[] = [];
    let finalText = '';

    for (let step = 0; step < 5; step++) {
      const data = await callResponses(session.apiUrl, session.token, {
        model: MODEL,
        instructions: buildSystemPrompt(teachingLevel),
        input,
        tools: TOOLS,
        temperature: 0.7,
        max_output_tokens: isReviewRequest ? 4096 : 2048,
      });

      const output: any[] = data.output || [];

      // Collect text from this response
      const text = extractText(output);
      if (text) finalText = text;

      // Check for function calls
      const fnCalls = extractFunctionCalls(output);
      if (fnCalls.length === 0) break; // No tool calls — done

      // Add ALL output items to input for next round (preserves the conversation)
      for (const item of output) {
        input.push(item);
      }

      // Execute each function call and add results to input
      for (const fc of fnCalls) {
        // A1: Return parse error to model on JSON failure instead of empty args
        let args: Record<string, any>;
        try {
          args = JSON.parse(fc.arguments);
        } catch {
          input.push({
            type: 'function_call_output',
            call_id: fc.callId,
            output: JSON.stringify({ error: 'Failed to parse tool arguments' }),
          });
          continue;
        }

        const { result, newState } = executeTool(fc.name, args, state);
        if (newState) state = newState;

        toolResults.push({ toolName: fc.name, args, result });

        // Feed tool result back as function_call_output
        input.push({
          type: 'function_call_output',
          call_id: fc.callId,
          output: JSON.stringify(result),
        });
      }
    }

    return NextResponse.json({
      text: finalText,
      toolResults,
      assistantMessage: { role: 'assistant', content: finalText },
    });
  } catch (err) {
    // A4: Generic error message to client, detailed logging server-side
    console.error('[GoSensei] API error:', err);
    return NextResponse.json({ error: 'An internal error occurred. Please try again.' }, { status: 500 });
  }
}
