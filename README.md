# General V1

A **general-purpose digital employee** built on [Meta Agent](./meta-agent/README.md) — designed for founders and power users who want an AI agent that can handle diverse tasks with proper identity, memory, planning, and boundaries.

## What It Does

General V1 is a configurable AI employee that combines:

- **Identity & Persona** — Generative identity and communication style
- **Memory** — Persistent memory across sessions via mem0
- **Planning & Execution** — Breaks down tasks and executes methodically
- **Mission Control** — Tracks tickets, progress, and completed work
- **Rule Book** — Operates within defined boundaries and guidelines
- **Browser** — Web browsing capability for research and actions
- **Communication** — Clear, professional interaction protocols
- **Permission System** — Operates with appropriate authority levels
- **JD Documentation** — Understands and references job description context
- **Display Stats** — Real-time performance and activity metrics

## Architecture

```
general-v1/
└── meta-agent/                         # Meta Agent framework
    ├── meta-agent-config/              # Digital employee configuration
    │   ├── config.json                 # Component loading config
    │   ├── auth.json.example           # API keys template
    │   ├── extensions/                 # TypeScript extensions
    │   │   ├── sub-agent-context.ts    # Sub-agent orchestration
    │   │   ├── mem0.ts                # Persistent memory
    │   │   ├── mission-control.ts      # Ticket tracking
    │   │   ├── communication.ts        # Interaction protocols
    │   │   ├── feedback-learning.ts    # Learning system (v2)
    │   │   ├── permission.ts           # Authority management
    │   │   └── display-stats.ts       # Stats display
    │   ├── skills/                     # Markdown knowledge
    │   │   ├── constitutions/         # Core principles
    │   │   ├── personas/              # Communication style
    │   │   ├── planning/              # Planning frameworks
    │   │   ├── mission-control/       # Task management
    │   │   ├── rules/                 # Boundaries
    │   │   ├── browser/               # Web browsing
    │   │   ├── communication/         # Interaction protocols
    │   │   ├── feedback/              # Learning (v2)
    │   │   ├── permission/            # Authority levels
    │   │   └── docs/                  # JD documentation
    │   └── prompts/                   # Extra system instructions
    ├── pi/                             # Pi Agent (terminal coding harness)
    ├── run.sh                          # Launch script
    └── README.md                       # Meta Agent documentation
```

## Components

### Core Skills (Markdown)

| Component | Description |
|-----------|-------------|
| **Persona** | Communication style and behavioral guidelines |
| **Identity** | Generative identity framework (name, role, background) |
| **Planning & Execution** | Task decomposition and execution methodology |
| **Mission Control** | Ticket tracking and progress documentation |
| **Rule Book** | Boundaries and operational guidelines |
| **Browser** | Web research and interaction protocols |
| **JD Documentation** | Job description context and relevance system |
| **Communication** | Interaction protocols and response standards |
| **Permission** | Authority levels and approval workflows |

### Core Extensions (TypeScript)

| Extension | Description |
|-----------|-------------|
| **mem0** | Persistent memory across sessions |
| **sub-agent-context** | Orchestrates sub-agents when needed |
| **mission-control** | Tracks tasks, progress, and completed items |
| **communication** | Manages interaction protocols |
| **permission** | Handles authority and approval logic |
| **display-stats** | Shows real-time metrics and performance |

### Base Capabilities (Pi Agent)

- All default Pi Agent tools
- Shell access and command execution
- File operations (read, write, edit, search)
- Git operations
- Terminal interaction

## Setup

### Prerequisites

- macOS or Linux
- Node.js >= 22.19.0
- API keys for your preferred LLM provider

### Installation

```bash
# Clone the repository
git clone https://github.com/rishi-ie/general-v1.git
cd general-v1

# Navigate to meta-agent
cd meta-agent

# Copy and configure API keys
cp meta-agent-config/auth.json.example meta-agent-config/auth.json
# Edit auth.json with your API keys (anthropic, openai, google, etc.)

# Run the employee
./run.sh
```

### Configuration

Edit `meta-agent-config/config.json` to customize which components are loaded:

```json
{
  "extensions": [
    "extensions/mem0.ts",
    "extensions/sub-agent-context.ts",
    "extensions/mission-control.ts",
    "extensions/communication.ts",
    "extensions/permission.ts",
    "extensions/display-stats.ts"
  ],
  "skills": [
    "skills/constitutions/...",
    "skills/personas/...",
    "skills/planning/...",
    "skills/mission-control/...",
    "skills/rules/...",
    "skills/browser/...",
    "skills/communication/...",
    "skills/permission/...",
    "skills/docs/..."
  ],
  "prompts": [
    "prompts/..."
  ]
}
```

## Usage

After setup, simply run:

```bash
cd meta-agent
./run.sh
```

The digital employee will:
1. Load all configured skills and extensions
2. Initialize memory and mission control
3. Present itself with a generative identity
4. Await your instructions

### Example Interactions

- **"I need to research competitors in the fintech space"** → Uses browser skill to research, mem0 to remember findings
- **"Track this task: redesign the landing page"** → Creates ticket in mission control, tracks progress
- **"What have you accomplished today?"** → Reviews mission control logs, summarizes progress
- **"Handle this with elevated permissions"** → Uses permission system for appropriate authority

## Development

### Adding New Skills

Create a markdown file in the appropriate `skills/` subdirectory:

```markdown
# My New Skill

## Purpose
Description of what this skill does.

## Guidelines
- Specific guidance for this skill
- Behavioral instructions
```

### Adding New Extensions

Create a TypeScript file in `meta-agent-config/extensions/`:

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function myExtension(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    // Your logic here
  });
}
```

## Roadmap

- [ ] **v1** — Core framework with all listed components
- [ ] **v2** — Feedback learning system activation
- [ ] **v3** — Advanced sub-agent orchestration
- [ ] **v4** — Multi-modal capabilities

## Related

- [Meta Agent](https://github.com/rishi-ie/meta-agent) — Framework this is built on
- [Pi Agent](https://github.com/earendil-works/pi) — Base terminal coding harness
- [Pi Extensions](https://pi.dev) — Extension documentation

## License

MIT
