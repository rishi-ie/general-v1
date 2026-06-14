# Meta Agent - Project Context

> Digital Employee Framework for Pi Agent

## What This Project Is

Meta Agent transforms Pi Agent into a **digital employee factory**. Instead of a generic coding assistant, you create specialized employees with:

- **Constitution** — Domain-specific principles and rules
- **Persona** — Communication style and behavior
- **Skills** — Domain knowledge and capabilities
- **Extensions** — Custom tools (model router, memory, context manager)
- **Prompts** — Extra system instructions

## Project Structure

```
meta-agent/                     # Root - cloned from this repo
│
├── pi/                         # Cloned Pi Agent (upstream)
│   ├── packages/
│   ├── scripts/
│   └── pi-test.sh
│
├── meta-agent-config/           # Digital employee configurations
│   ├── extensions/              # .ts files - custom behavior
│   │   └── *.ts
│   │
│   ├── skills/                  # .md files - knowledge and behavior
│   │   ├── constitutions/
│   │   │   └── 00-CONSTITUTION.md
│   │   ├── personas/
│   │   │   └── 10-PERSONA.md
│   │   └── domain/
│   │       └── 20-SKILL-*.md
│   │
│   ├── prompts/                # .md files - extra system instructions
│   │   └── *.md
│   │
│   └── config.json             # Launch configuration
│
├── run.sh                       # Launch script
│
├── AGENTS.md                    # This file
├── architecture.md               # Full technical documentation
├── README.md                    # Quick start guide
└── LICENSE                      # MIT
```

## Three Types of Modular Components

Every module in Meta Agent is either:

### 1. Skills (Markdown Files)
**What they are:** Knowledge and behavior definitions
**What they do:** Become part of the system prompt
**How they load:** Via `--skill` flag or auto-discovery

```
skills/
├── constitutions/       # Core principles and boundaries
│   └── 00-CONSTITUTION-[domain].md
├── personas/          # Communication style and tone
│   └── 10-PERSONA-[domain].md
└── domain/            # Domain-specific knowledge
    └── 20-SKILL-[name].md
```

### 2. Extensions (TypeScript Files)
**What they are:** Code that runs in Pi Agent
**What they do:** Subscribe to events, register tools/commands
**How they load:** Via `-e` flag or auto-discovery

```
extensions/
├── model-router.ts       # Routes tasks to appropriate models
├── memory.ts             # Learns and persists facts
├── context-manager.ts    # Manages context window
└── persona.ts           # Injects behavioral guidance
```

### 3. Prompts (Markdown Files)
**What they are:** Extra system instructions
**What they do:** Append to system prompt
**How they load:** Via `--prompt` flag or config

```
prompts/
├── extra-instructions.md
└── success-criteria.md
```

## Setup Flow (One Time)

```bash
# 1. Clone this repo
git clone https://github.com/rishi-ie/meta-agent.git
cd meta-agent

# 2. Clone Pi Agent inside
git clone https://github.com/earendil-works/pi.git pi

# 3. Install dependencies
cd pi
npm install
cd ..

# 4. Done - ready to configure
```

## Configuration Flow

### 1. Edit Extensions (Optional)

Create or modify files in `meta-agent-config/extensions/`:

```typescript
// meta-agent-config/extensions/my-extension.ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function myExtension(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    // Your logic here
  });
}
```

### 2. Edit Skills

Create or modify files in `meta-agent-config/skills/`:

```markdown
<!-- meta-agent-config/skills/constitutions/00-CONSTITUTION-my-employee.md -->
# My Employee Constitution

## Core Principles
1. Always prioritize safety
2. Be transparent about uncertainty

## Boundaries
- DO NOT make unilateral decisions
- DO ask for clarification when unsure
```

### 3. Edit Prompts (Optional)

Add extra system instructions in `meta-agent-config/prompts/`:

```markdown
<!-- meta-agent-config/prompts/extra-instructions.md -->
## Additional Instructions
- Always verify changes before committing
- Ask before destructive actions
```

### 4. Update Launch Config

Edit `meta-agent-config/config.json`:

```json
{
  "extensions": [
    "extensions/model-router.ts",
    "extensions/memory.ts",
    "extensions/context-manager.ts",
    "extensions/persona.ts"
  ],
  "skills": [
    "skills/constitutions/00-CONSTITUTION.md",
    "skills/personas/10-PERSONA.md",
    "skills/domain/20-SKILL-my-domain.md"
  ],
  "prompts": [
    "prompts/extra-instructions.md"
  ],
  "model": {
    "primary": "claude-sonnet"
  }
}
```

## Running the Employee

```bash
# From meta-agent folder
./run.sh

# Pi Agent starts with all configurations loaded
# Extensions register tools and commands
# Skills become part of system prompt
# Digital employee is ready
```

## Key Events (Extension Development)

| Event | When | Common Uses |
|-------|------|-------------|
| `session_start` | Session begins | Initialize state |
| `session_shutdown` | Session ends | Persist state |
| `before_agent_start` | Before each turn | Inject context, route model |
| `turn_end` | After each turn | Store facts, check context |
| `tool_result` | After tool execution | Learn from results |
| `message_start` | Message begins | Detect context |

## Context API (Extension Development)

```typescript
// Send message to agent (display: false = hidden from user)
ctx.sendMessage({ customType: "...", content: "...", display: false });

// Persist data across sessions
ctx.appendEntry("my-data", { key: "value" });

// Access session entries
const entries = ctx.sessionManager.getEntries();

// Get context usage
const usage = ctx.getContextUsage();

// Trigger compaction
ctx.compact({ customInstructions: "Summarize" });

// Switch model
await pi.setModel(targetModel);

// Show notification
ctx.ui.notify("Message", "info");
```

## Skill Priority System

Skills load by filename prefix (priority order):

```
00-CONSTITUTION-*  → Priority 1 (loaded first)
10-PERSONA-*       → Priority 2
20-SKILL-*         → Priority 3 (loaded third)
```

This ensures constitution always applies before persona, and both apply before domain skills.

## Extension Loading Order

Extensions load in the order specified in `config.json`:

```json
{
  "extensions": [
    "extensions/model-router.ts",
    "extensions/memory.ts",
    "extensions/context-manager.ts",
    "extensions/persona.ts"
  ]
}
```

## Modularity Layers for Human-Like Employee

| Layer | Type | Purpose |
|-------|------|---------|
| **Brain** | Skills | What the employee knows |
| **Memory** | Extensions | What the employee remembers |
| **Character** | Skills | How the employee behaves |
| **Self-Awareness** | Extensions | Employee knows its limits |
| **Goal Management** | Extensions | Employee tracks objectives |
| **Task Execution** | Extensions | Employee routes tasks |
| **Learning** | Extensions | Employee improves over time |

Every layer is either a **Skill** (markdown) or an **Extension** (code).

## Testing Extensions

```bash
# Test single extension
cd pi && ./pi-test.sh -e ../meta-agent-config/extensions/my-extension.ts

# Test with skills
cd pi && ./pi-test.sh -e ../meta-agent-config/extensions/my-extension.ts --skill ../meta-agent-config/skills/constitutions/00-CONSTITUTION.md
```

## Security Notes

- Extensions run with full system access
- Only install from trusted sources
- Review constitutions before deployment
- Consider sandboxing for untrusted employees

## Related Projects

- [Pi Agent](https://github.com/earendil-works/pi) - The base framework
- [Pi Agent Extensions](https://pi.dev) - Extension documentation

## Conventions

1. **Skill naming**: Priority prefix (00-, 10-, 20-)
2. **Extension exports**: Default function, receives `ExtensionAPI`
3. **Config format**: JSON with `extensions`, `skills`, `prompts` arrays
4. **File paths**: Relative to `meta-agent-config/` folder