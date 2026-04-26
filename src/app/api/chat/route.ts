import { NextResponse } from 'next/server';
import { getCopilotSession } from '@/lib/ai/copilot-auth';
import { buildSystemPrompt } from '@/lib/ai/system-prompt';
import type { TeachingLevel } from '@/lib/ai/system-prompt';
import { reconstructGame } from '@/lib/ai/tools';
import {
  createGame, playMove, passMove, isValidMove,
  getGroup, getLibertiesOf, countLiberties, boardToText,
  coordToPoint, computeInfluence,
} from '@/lib/go-engine';
import type { BoardSize, GameState } from '@/lib/go-engine/types';

export const maxDuration = 60;

const MODEL = 'gpt-5.4';

// Responses API tool format — flat, NOT nested under a "function" key
const TOOLS = [
  {
    type: 'function' as const,
    name: 'make_move',
    description: 'Place a stone on the board. Use standard Go coordinates (e.g., "D4", "Q16").',
    parameters: {
      type: 'object',
      properties: {
        position: { type: 'string', description: 'Go coordinate like "D4", "Q16", "K10". Letter=column (A-T, skipping I), Number=row (1-19 for 19x19).' },
        reasoning: { type: 'string', description: 'Brief reasoning shown to student' },
      },
      required: ['position', 'reasoning'],
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
            properties: {
              position: { type: 'string', description: 'Go coordinate like "D4", "Q16"' },
              label: { type: 'string', description: 'Short educational label for this position (e.g., "Star point", "Weak group", "Cut point")' },
            },
            required: ['position'],
          },
          description: 'Positions to highlight with optional per-position labels',
        },
        style: { type: 'string', enum: ['positive', 'warning', 'danger', 'neutral'], description: 'Visual style for the highlights' },
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
        position: { type: 'string', description: 'Go coordinate of any stone in the group, e.g., "D4"' },
      },
      required: ['position'],
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
              position: { type: 'string', description: 'Go coordinate like "D4"' },
              label: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['position', 'label', 'reason'],
          },
        },
      },
      required: ['suggestions'],
    },
  },
  {
    type: 'function' as const,
    name: 'show_sequence',
    description: 'Show a sequence of moves as numbered arrows on the board to illustrate reading/variations.',
    parameters: {
      type: 'object',
      properties: {
        moves: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string', description: 'Starting Go coordinate (e.g., "D4")' },
              to: { type: 'string', description: 'Ending Go coordinate (e.g., "E5")' },
              label: { type: 'string', description: 'Short explanation of this move' },
            },
            required: ['from', 'to'],
          },
        },
      },
      required: ['moves'],
    },
  },
  {
    type: 'function' as const,
    name: 'show_influence',
    description: 'Display an influence/moyo heatmap on the board showing which areas each player controls or influences. Blue = black, orange = white.',
    parameters: { type: 'object', properties: {} },
  },
  {
    type: 'function' as const,
    name: 'show_groups',
    description: 'Highlight stone groups showing boundaries, connections, and liberty counts. Weak groups (≤2 liberties) shown with red dashed borders. Use to teach connections, cutting, life and death.',
    parameters: {
      type: 'object',
      properties: {
        positions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              position: { type: 'string', description: 'Go coordinate of a stone in the group (e.g., "D4")' },
              label: { type: 'string', description: 'Educational label (e.g., "Strong wall", "Weak — needs help")' },
            },
            required: ['position'],
          },
          description: 'One stone from each group to visualize. Server auto-expands to full group.',
        },
      },
      required: ['positions'],
    },
  },
  {
    type: 'function' as const,
    name: 'evaluate_concepts',
    description:
      'Identify which Go concepts are demonstrated in the current position or recent move. ' +
      'Use this after notable moves or when teaching to track what the student is learning. ' +
      'Only report concepts that are clearly relevant to what just happened.',
    parameters: {
      type: 'object',
      properties: {
        concepts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              conceptId: {
                type: 'string',
                description:
                  'Concept ID from the known set: stones-and-board, liberties, capture, groups, eyes, ko, territory, scoring, ' +
                  'atari, ladder, net, snapback, double-atari, connect-and-cut, throw-in, life-and-death, seki, tesuji, ' +
                  'influence, thickness, moyō, invasion-vs-reduction, shape, direction-of-play, fighting, ' +
                  'corner-opening, joseki, fuseki, sente-gote, endgame-counting',
              },
              reason: {
                type: 'string',
                description: 'Brief explanation of why this concept is relevant right now.',
              },
            },
            required: ['conceptId', 'reason'],
          },
          description: 'List of concepts demonstrated in the current position.',
        },
      },
      required: ['concepts'],
    },
  },
];

type JsonRecord = Record<string, unknown>;

interface ClientMove {
  type: string;
  x?: number;
  y?: number;
  color?: string;
}

interface FunctionCallItem {
  id: string;
  callId: string;
  name: string;
  arguments: string;
}

interface ChatHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

interface ToolResultItem {
  toolName: string;
  args: JsonRecord;
  result: JsonRecord;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asObjectArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function compact<T>(value: T | null): value is T {
  return value !== null;
}

function parseBoardSize(value: unknown): BoardSize {
  return value === 9 || value === 13 || value === 19 ? value : 9;
}

function parseTeachingLevel(value: unknown): TeachingLevel {
  const validLevels: TeachingLevel[] = ['beginner', 'intermediate', 'advanced', 'guided'];
  return typeof value === 'string' && validLevels.includes(value as TeachingLevel)
    ? value as TeachingLevel
    : 'beginner';
}

function parseMoveHistory(value: unknown): ClientMove[] {
  return asObjectArray(value)
    .map((move) => ({
      type: asString(move.type),
      x: typeof move.x === 'number' ? move.x : undefined,
      y: typeof move.y === 'number' ? move.y : undefined,
      color: typeof move.color === 'string' ? move.color : undefined,
    }))
    .filter((move) => move.type.length > 0);
}

function parseChatHistory(value: unknown): ChatHistoryItem[] {
  return asObjectArray(value)
    .filter((msg) =>
      (msg.role === 'user' || msg.role === 'assistant') &&
      typeof msg.content === 'string'
    )
    .map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: asString(msg.content).slice(0, 10_000),
    }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : '';
}

function executeTool(
  name: string,
  args: JsonRecord,
  state: GameState,
): { result: JsonRecord; newState?: GameState } {
  switch (name) {
    case 'make_move': {
      const position = asString(args.position);
      const pt = coordToPoint(position, state.board.size);
      if (!pt) {
        return { result: { success: false, error: `Invalid coordinate: "${position}". Use format like "D4" or "Q16".` } };
      }
      if (!isValidMove(state, pt)) {
        return { result: { success: false, error: `Invalid move at ${position}. That position may be occupied, suicidal, or violate ko.`, currentBoard: boardToText(state) } };
      }
      const r = playMove(state, pt);
      if (!r.success) return { result: { success: false, error: r.reason } };
      return {
        result: {
          success: true,
          move: position,
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
    case 'highlight_positions': {
      const positions = asObjectArray(args.positions).map((p) => {
        const pt = coordToPoint(asString(p.position), state.board.size);
        return pt ? { x: pt.x, y: pt.y, label: p.label } : null;
      }).filter(compact);
      return { result: { positions, style: args.style } };
    }
    case 'show_liberty_count': {
      const position = asString(args.position);
      const pt = coordToPoint(position, state.board.size);
      if (!pt) return { result: { success: false, error: `Invalid coordinate: "${position}"` } };
      const g = getGroup(state.board, pt);
      if (!g) return { result: { success: false, error: `No stone at ${position}` } };
      return {
        result: {
          success: true,
          group: g.stones,
          liberties: getLibertiesOf(state.board, pt),
          count: countLiberties(state.board, pt),
        },
      };
    }
    case 'suggest_moves': {
      const suggestions = asObjectArray(args.suggestions).map((s) => {
        const pt = coordToPoint(asString(s.position), state.board.size);
        return pt ? { x: pt.x, y: pt.y, label: s.label, reason: s.reason } : null;
      }).filter(compact);
      return { result: { suggestions } };
    }
    case 'show_sequence': {
      const moves = asObjectArray(args.moves).map((m, i) => {
        const from = coordToPoint(asString(m.from), state.board.size);
        const to = coordToPoint(asString(m.to), state.board.size);
        if (!from || !to) return null;
        return { from, to, label: m.label, order: i + 1 };
      }).filter(compact);
      return { result: { moves } };
    }
    case 'show_influence': {
      const influence = computeInfluence(state.board);
      return { result: { influence } };
    }
    case 'show_groups': {
      const groups = asObjectArray(args.positions).map((p, i) => {
        const pt = coordToPoint(asString(p.position), state.board.size);
        if (!pt) return null;
        const group = getGroup(state.board, pt);
        if (!group) return null;
        return {
          id: `grp-${i}`,
          stones: group.stones,
          color: group.color, // already 'black' | 'white'
          liberties: group.liberties.length,
          label: p.label,
        };
      }).filter(compact);
      return { result: { groups } };
    }
    case 'evaluate_concepts': {
      const validIds = new Set([
        'stones-and-board', 'liberties', 'capture', 'groups', 'eyes', 'ko', 'territory', 'scoring',
        'atari', 'ladder', 'net', 'snapback', 'double-atari', 'connect-and-cut', 'throw-in',
        'life-and-death', 'seki', 'tesuji', 'influence', 'thickness', 'moyō',
        'invasion-vs-reduction', 'shape', 'direction-of-play', 'fighting',
        'corner-opening', 'joseki', 'fuseki', 'sente-gote', 'endgame-counting',
      ]);
      const concepts = asObjectArray(args.concepts)
        .filter((c) => typeof c.conceptId === 'string' && validIds.has(c.conceptId))
        .map((c) => ({ conceptId: c.conceptId, reason: c.reason }));
      return { result: { concepts, count: concepts.length } };
    }
    default:
      return { result: { error: `Unknown tool: ${name}` } };
  }
}

/* ── Responses API helpers ── */

async function fetchWithRetry(fn: () => Promise<Response>, retries = 1): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const resp = await fn();
      if (resp.ok || i === retries) return resp;
      // Retry on 5xx server errors
      if (resp.status >= 500) {
        console.log(`[GoSensei] Server error ${resp.status}, retrying...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return resp;
    } catch (err) {
      if (i === retries) throw err;
      console.log(`[GoSensei] Network error, retrying...`, (err as Error).message);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error('Unreachable');
}

async function callResponses(apiUrl: string, token: string, body: JsonRecord): Promise<JsonRecord> {
  console.log('[GoSensei] POST /responses, model:', body.model, 'input items:', Array.isArray(body.input) ? body.input.length : 1);

  const resp = await fetchWithRetry(() => fetch(`${apiUrl}/responses`, {
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
  }));

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Copilot API ${resp.status}: ${txt.slice(0, 500)}`);
  }
  const data = await resp.json() as unknown;
  return isRecord(data) ? data : {};
}

/** Extract assistant text from a Responses API output array */
function extractText(output: unknown[]): string {
  const parts: string[] = [];
  for (const item of output) {
    if (!isRecord(item)) continue;
    if (item.type === 'message' && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (isRecord(c) && c.type === 'output_text' && typeof c.text === 'string') {
          parts.push(c.text);
        }
      }
    }
  }
  return parts.join('\n');
}

/** Extract function_call items from a Responses API output array */
function extractFunctionCalls(output: unknown[]): FunctionCallItem[] {
  return output
    .filter((item): item is JsonRecord => isRecord(item) && item.type === 'function_call')
    .map((item) => ({
      id: asString(item.id),
      callId: asString(item.call_id) || asString(item.id),
      name: asString(item.name),
      arguments: asString(item.arguments),
    }));
}

export async function POST(req: Request) {
  try {
    const requestData = await req.json() as unknown;
    const body = isRecord(requestData) ? requestData : {};
    const message = asString(body.message);
    const gsData = isRecord(body.gameState) ? body.gameState : {};

    // S3: Sanitize chat history — only allow user/assistant roles with string content
    const sanitizedHistory = parseChatHistory(body.chatHistory);

    // A2: Validate boardSize and komi
    const boardSize = parseBoardSize(gsData.boardSize);
    const komi = typeof gsData.komi === 'number' ? Math.min(Math.max(gsData.komi, 0), 100) : 6.5;

    const teachingLevel = parseTeachingLevel(gsData.teachingLevel);
    const guidedContext = typeof gsData.guidedContext === 'string' ? gsData.guidedContext : undefined;

    // A3: Reconstruct game state, return 400 on invalid move history
    let state: GameState;
    try {
      if (Array.isArray(gsData.moveHistory)) {
        state = reconstructGame(parseMoveHistory(gsData.moveHistory), boardSize, komi);
      } else {
        state = createGame(9, 6.5);
      }
    } catch {
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
    const input: JsonRecord[] = [
      ...sanitizedHistory.slice(-20),
      { role: 'user', content: message },
    ];

    const isReviewRequest = message.includes('GAME REVIEW REQUEST');

    // Agentic loop — up to 5 tool-call rounds
    const toolResults: ToolResultItem[] = [];
    let finalText = '';

    for (let step = 0; step < 5; step++) {
      const data = await callResponses(session.apiUrl, session.token, {
        model: MODEL,
        instructions: buildSystemPrompt(teachingLevel, guidedContext),
        input,
        tools: TOOLS,
        max_output_tokens: isReviewRequest ? 4096 : 2048,
      });

      const output = Array.isArray(data.output) ? data.output : [];

      // Collect text from this response
      const text = extractText(output);
      if (text) finalText = text;

      // Check for function calls
      const fnCalls = extractFunctionCalls(output);
      if (fnCalls.length === 0) break;

      // Add ALL output items to input for next round (preserves the conversation)
      for (const item of output) {
        if (isRecord(item)) {
          input.push(item);
        }
      }

      // Execute each function call and add results to input
      for (const fc of fnCalls) {
        // A1: Return parse error to model on JSON failure instead of empty args
        let args: JsonRecord;
        try {
          const parsedArgs = JSON.parse(fc.arguments) as unknown;
          args = isRecord(parsedArgs) ? parsedArgs : {};
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
  } catch (err: unknown) {
    console.error('[GoSensei] API error:', err);

    // Auth errors → 401 so client knows to re-login
    const message = errorMessage(err);
    if (errorName(err) === 'AuthError' || message.includes('401') || message.includes('Bad credentials')) {
      return NextResponse.json(
        { error: 'Your session has expired. Please re-login with GitHub.', code: 'AUTH_EXPIRED' },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      { status: 500 },
    );
  }
}
