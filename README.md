# 碁 Go Sensei — Learn Go with AI

An AI-powered Go teaching app that plays against you and teaches you the game in real-time. Built for complete beginners.

![Go Sensei](https://img.shields.io/badge/Model-GPT--5.4-blue) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Tests](https://img.shields.io/badge/Tests-118%20passing-green) ![License](https://img.shields.io/badge/License-MIT-yellow)

## What is this?

Go Sensei is a web app where an AI teacher (powered by GPT-5.4 via GitHub Copilot) plays Go against you while explaining every move. It's designed for people who have **never played Go before**.

The AI uses tools to interact with the board — highlighting positions, showing liberty counts, suggesting moves — making the teaching visual and spatial, not just text.

### Features

- 🎮 **Full Go game engine** — captures, ko, suicide detection, Chinese scoring, all board sizes (9×9, 13×13, 19×19)
- 🤖 **AI Go Master** with 5 teaching tools — makes moves, highlights board areas, shows liberties, suggests moves
- 🎯 **Agentic tool loop** — the AI calls multiple tools per turn (highlight → explain → move) via OpenAI Responses API
- ✨ **Animated SVG board** — Framer Motion spring-based stone placement, capture dissolve effects, pulsing highlights
- 💬 **Scrollable chat log** — Sensei's teaching messages accumulate (no overwriting)
- 📖 **Rules panel** — Go rules always visible on the right sidebar
- 🔐 **GitHub OAuth** — login with your GitHub account (Device Flow), no API keys needed
- 🧪 **118 tests** — comprehensive engine test suite (captures, ko, scoring, serialization)

## Quick Start

### Prerequisites
- Node.js 18+
- A [GitHub Copilot](https://github.com/features/copilot) subscription

### Setup

```bash
git clone https://github.com/deaddeadbeef/go-sensei.git
cd go-sensei
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click ⚙ Settings → **Login with GitHub** → authorize → play!

### Alternative: Environment Variable

If you prefer, set a GitHub token directly:

```bash
echo GITHUB_TOKEN=ghp_your-token-here > .env.local
npm run dev
```

## Architecture

```
┌─── SenseiBar ──────────────────────────────────────────────────┐
├────────────────────────────┬───────────────────────────────────┤
│                            │  Rules of Go                      │
│                            │  • Place stones on intersections  │
│                            │  • Surround territory to win      │
│     SVG Go Board (70%)     │  • Capture groups with 0 libs     │
│     Framer Motion anims    │  ────────────────────────────────  │
│                            │  Sensei Chat Log (scrollable)     │
│                            │  🎓 Welcome! I'm Go Sensei...     │
│  [Pass] [Undo] [New Game]  │  🎓 Good move! You placed...      │
│                            │  💬 Ask Sensei...          [Send]  │
└────────────────────────────┴───────────────────────────────────┘
```

### Tech Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| Framework | Next.js 16 (App Router) | Server + Client |
| UI | React 19 + Tailwind CSS | Components + Styling |
| Animations | Framer Motion | Stone drops, captures, highlights |
| State | Zustand | Game state, overlays, chat messages |
| AI Model | GPT-5.4 via GitHub Copilot | Teaching + playing |
| AI Protocol | OpenAI Responses API | Agentic tool loop |
| Auth | GitHub OAuth Device Flow | No secrets, no redirects |
| Engine | Pure TypeScript | Zero dependencies, isomorphic |
| Tests | Vitest | 118 tests |

### Go Engine

The game engine is pure TypeScript with zero dependencies, designed to run isomorphically (client + server):

```
src/lib/go-engine/
├── types.ts         # Core types (GameState, BoardState, Move, etc.)
├── board.ts         # Board operations (create, clone, adjacency)
├── groups.ts        # Flood-fill group detection
├── liberties.ts     # Liberty counting, atari detection
├── rules.ts         # Move validation, captures, ko, suicide
├── game.ts          # Game lifecycle (play, pass, resign, undo)
├── scoring.ts       # Chinese territory scoring
├── serialization.ts # Board → text for AI, coordinate conversion
└── index.ts         # Public API
```

### AI Teaching Tools

The AI has 5 tools it can call each turn:

| Tool | What it does | Visual |
|------|-------------|--------|
| `make_move` | Places a stone on the board | Animated stone drop |
| `pass_turn` | Passes the turn | — |
| `highlight_positions` | Highlights board areas (danger/opportunity/info) | Colored pulsing rings |
| `show_liberty_count` | Shows a group's liberties | Numbered badges + dots |
| `suggest_moves` | Suggests 1-3 moves | Pulsing ghost stones |

The agentic loop runs server-side: GPT-5.4 can call multiple tools per turn (e.g., highlight a group → show its liberties → make a move → explain). Up to 5 tool-call rounds per turn.

### Authentication Flow

Uses [GitHub OAuth Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow):

1. User clicks "Login with GitHub"
2. App displays a code (e.g., `ABCD-1234`)
3. User enters code at `github.com/login/device`
4. App polls until authorized
5. Token exchanged for Copilot session token
6. All AI calls use the Copilot API (`api.githubcopilot.com`)

No client secrets, no redirect URLs, no separate API keys.

## Development

### Run Tests

```bash
npm test        # Watch mode
npm run test:run # Single run (118 tests)
```

### Build

```bash
npm run build
```

### Project Structure

```
go-sensei/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Main game page
│   │   ├── api/chat/route.ts   # AI endpoint (Responses API)
│   │   └── api/auth/           # OAuth device flow routes
│   ├── lib/
│   │   ├── go-engine/          # Pure TS game engine (9 files)
│   │   └── ai/                 # AI tools, prompts, auth
│   ├── components/
│   │   ├── board/              # SVG board + overlays (13 files)
│   │   ├── chat/               # Chat log
│   │   ├── game/               # Controls, score card
│   │   ├── tutorial/           # (planned)
│   │   └── ui/                 # Bar, input, settings, rules
│   ├── stores/                 # Zustand game store
│   ├── hooks/                  # useGoMaster, useGitHubAuth, etc.
│   └── utils/                  # Colors, coordinates, animation
├── __tests__/go-engine/        # 118 engine tests
└── package.json
```

## Roadmap

- [ ] Streaming AI responses (currently waits for full response)
- [ ] Interactive tutorials (planned component structure exists)
- [ ] Sound effects (stone placement, captures)
- [ ] Move review / replay mode
- [ ] Responsive mobile layout
- [ ] Scoring phase UI (dead stone marking)

## License

MIT

---

Built with ❤️ by a human and an AI, playing Go together.
