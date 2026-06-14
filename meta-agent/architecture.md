# Meta Agent Architecture

> Digital Employee Framework for Pi Agent

---

## Overview

Meta Agent is a framework that enables the creation of specialized digital employees on top of Pi Agent. Each employee is a configured instance combining constitution, persona, skills, and extensions.

```
┌─────────────────────────────────────────────────────────────┐
│                        META AGENT                           │
│                     Digital Employee Factory                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Constitution│  │   Persona   │  │   Skills    │          │
│  │   (Skill)   │  │   (Skill)   │  │  (Domain)   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│                                                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │   Model    │  │   Memory   │  │  Context    │             │
│  │   Router   │  │  Extension │  │  Manager    │             │
│  │(Extension) │  │ (Extension)│  │(Extension)  │             │
│  └────────────┘  └────────────┘  └────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Digital Employee

A configured instance combining:
- **Constitution** — Domain-specific principles and rules
- **Persona** — Communication style and behavior
- **Skills** — Domain knowledge and capabilities
- **Extensions** — Custom tools (model router, memory, context manager)

### 2. Constitution (Skill)

Domain-specific principles loaded as a skill.

```markdown
# [Domain] Constitution

## Core Principles
1. [Principle 1]
2. [Principle 2]
3. [Principle 3]

## Decision Framework
Before any action:
- Does this align with core principles?
- Is there a risk I should consider?

## Boundaries
- DO NOT [prohibited action 1]
- DO NOT [prohibited action 2]
- DO [allowed action 1]
```

### 3. Persona (Skill)

Communication style loaded as a skill.

```markdown
# [Domain] Persona

## Communication Style
- Clear and concise
- Professional but friendly
- Ask clarifying questions

## Tone
- Confident but not arrogant
- Helpful and proactive
```

### 4. System Prompt Priority

Components load in priority order via skill naming:

```
Priority 1: 00-CONSTITUTION-*  → Constitution (loaded first)
Priority 2: 10-PERSONA-*       → Persona (loaded second)
Priority 3: 20-SKILL-*        → Domain skills (loaded third)
```

---

## Extensions

### Model Router

Routes tasks to appropriate models based on complexity.

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  const task = classifyTask(event.prompt);
  const targetModel = routeToModel(task);
  
  if (targetModel !== ctx.model) {
    await pi.setModel(targetModel);
  }
});
```

| Task Type | Keywords | Model |
|-----------|----------|-------|
| Quick | format, lint, typo, comment | haiku |
| Reasoning | debug, fix, refactor, analyze | sonnet |
| Strong | architect, design, complex | opus |

### Memory System

Learns from interactions and persists across sessions.

```typescript
// Learn from tool results
pi.on("tool_result", async (event, ctx) => {
  const facts = extractFacts(event.content);
  ctx.appendEntry("learned-facts", facts);
});

// Retrieve on relevant prompts
pi.on("before_agent_start", async (event, ctx) => {
  const relevant = retrieveMemories(event.prompt);
  ctx.sendMessage({ customType: "memory", content: relevant });
});
```

### Context Manager

Actively manages context window to prevent overflow.

```typescript
pi.on("turn_end", async (event, ctx) => {
  const usage = ctx.getContextUsage();
  
  if (usage?.percent > 85) {
    ctx.compact({
      customInstructions: "Summarize context, preserve key facts"
    });
  }
});
```

### Persona Manager

Injects behavioral cues based on context.

```typescript
pi.on("before_agent_start", async (event, ctx) => {
  const cues = generateCues(event.prompt);
  ctx.sendMessage({ customType: "persona", content: formatCues(cues) });
});
```

---

## Directory Structure

```
meta-agent/
├── skills/                     # Skill templates
│   ├── constitutions/          # Domain principles
│   │   ├── 00-CONSTITUTION-template.md
│   │   └── [domain]/
│   │       └── 00-CONSTITUTION-[domain].md
│   ├── personas/               # Communication styles
│   │   ├── 00-PERSONA-template.md
│   │   └── [domain]/
│   │       └── 10-PERSONA-[domain].md
│   └── domain/                # Domain knowledge
│
├── employees/                  # Employee configurations
│   └── [name]/
│       └── config.json
│
├── architecture.md             # This file
└── README.md                   # User guide
```

---

## Employee Configuration

### config.json

```json
{
  "name": "medical-assistant",
  "version": "1.0.0",
  "description": "AI assistant for medical documentation",
  
  "constitution": {
    "path": "skills/constitutions/medical/00-CONSTITUTION-medical.md",
    "priority": 1
  },
  
  "persona": {
    "path": "skills/personas/medical/10-PERSONA-medical.md",
    "priority": 2
  },
  
  "extensions": [
    "model-router",
    "memory",
    "context-manager",
    "persona"
  ],
  
  "model": {
    "primary": "claude-sonnet",
    "routing": {
      "quick": "claude-haiku",
      "reasoning": "claude-sonnet",
      "strong": "claude-opus"
    }
  },
  
  "skills": [
    "medical-guidelines"
  ]
}
```

### Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Employee identifier |
| `version` | string | Config version |
| `description` | string | What this employee does |
| `constitution.path` | string | Path to constitution skill |
| `persona.path` | string | Path to persona skill |
| `extensions` | array | Extensions to load |
| `model.primary` | string | Default model |
| `model.routing` | object | Task-to-model mappings |
| `skills` | array | Additional skill paths |

---

## Integration with Pi Agent

### How It Works

Meta Agent extensions are standard Pi Agent extensions. They:
1. Register event handlers for lifecycle hooks
2. Register custom tools when needed
3. Register commands for user interaction
4. Use `sendMessage()` and `appendEntry()` for context injection

### Loading Extensions

Extensions load via Pi Agent's `-e` flag:

```bash
pi -e ./extensions/model-router.ts \
   -e ./extensions/memory.ts \
   -e ./extensions/context-manager.ts \
   -e ./extensions/persona.ts
```

### Loading Skills

Skills load via Pi Agent's `--skill` flag:

```bash
pi --skill ./skills/constitutions/medical/00-CONSTITUTION-medical.md \
   --skill ./skills/personas/medical/10-PERSONA-medical.md
```

### Running a Complete Employee

```bash
pi -e ./extensions/model-router.ts \
   -e ./extensions/memory.ts \
   -e ./extensions/context-manager.ts \
   -e ./extensions/persona.ts \
   --skill ./skills/constitutions/medical/00-CONSTITUTION-medical.md \
   --skill ./skills/personas/medical/10-PERSONA-medical.md
```

---

## Extension API

### Available Imports

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
```

### Event Subscription

```typescript
pi.on("event_name", async (event, ctx) => {
  // Handle event
});
```

### Available Events

| Event | When | Use Case |
|-------|------|----------|
| `session_start` | Session begins | Initialize state |
| `session_shutdown` | Session ends | Persist state |
| `before_agent_start` | Before each turn | Inject context, route model |
| `turn_end` | After each turn | Store facts, check context |
| `tool_result` | After tool execution | Learn from results |
| `message_start` | Message begins | Detect context |

### Registering Tools

```typescript
pi.registerTool({
  name: "my-tool",
  label: "My Tool",
  description: "Does something",
  parameters: Type.Object({
    input: Type.String()
  }),
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    return {
      content: [{ type: "text", text: "Result" }],
      details: {}
    };
  }
});
```

### Registering Commands

```typescript
pi.registerCommand("my-command", {
  description: "Does something",
  handler: async (args, ctx) => {
    ctx.ui.notify("Done", "info");
  }
});
```

### Context API

```typescript
// Send message to agent
ctx.sendMessage({ customType: "...", content: "...", display: false });

// Persist data across sessions
ctx.appendEntry("my-data", { key: "value" });

// Access session state
ctx.sessionManager.getEntries();

// Model operations
ctx.modelRegistry.getModels();
await pi.setModel(model);

// Context usage
ctx.getContextUsage();

// Compaction
ctx.compact({ customInstructions: "..." });
```

---

## Extension Implementation Guide

### 1. Model Router Extension

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ROUTES = {
  quick: ["format", "lint", "typo"],
  reasoning: ["debug", "fix", "refactor"],
  strong: ["architect", "design", "complex"]
};

export default function modelRouter(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    const task = classify(event.prompt);
    const targetModel = MODEL_MAP[task];
    
    if (ctx.model?.id.includes(targetModel)) return;
    
    const models = ctx.modelRegistry.getModels();
    const model = models.find(m => m.id.includes(targetModel));
    
    if (model) await pi.setModel(model);
  });
}

function classify(prompt: string): keyof typeof ROUTES {
  const lower = prompt.toLowerCase();
  for (const [type, keywords] of Object.entries(ROUTES)) {
    if (keywords.some(k => lower.includes(k))) return type as any;
  }
  return "reasoning";
}
```

### 2. Memory Extension

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function memory(pi: ExtensionAPI) {
  pi.on("turn_end", async (event, ctx) => {
    const facts = extractFacts(event.message);
    if (facts.length > 0) {
      ctx.appendEntry("learned-facts", facts);
    }
  });
  
  pi.on("before_agent_start", async (event, ctx) => {
    const memories = ctx.sessionManager.getEntries()
      .filter(e => e.customType === "learned-facts")
      .flatMap(e => e.data as string[]);
    
    const relevant = memories.filter(m => 
      m.toLowerCase().split(" ").some(w => event.prompt.includes(w))
    );
    
    if (relevant.length > 0) {
      ctx.sendMessage({
        customType: "memory",
        content: `## Relevant Memories\n\n${relevant.join("\n")}`
      });
    }
  });
}
```

### 3. Context Manager Extension

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function contextManager(pi: ExtensionAPI) {
  pi.on("turn_end", async (event, ctx) => {
    const usage = ctx.getContextUsage();
    
    if (usage?.percent && usage.percent > 85) {
      ctx.compact({
        customInstructions: "Summarize conversation, preserve key facts"
      });
    }
  });
  
  pi.registerCommand("compact", {
    description: "Manually compact context",
    handler: async (args, ctx) => {
      ctx.compact({
        customInstructions: "Summarize context"
      });
    }
  });
}
```

### 4. Persona Extension

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function persona(pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event, ctx) => {
    const cues = generateCues(event.prompt);
    ctx.sendMessage({
      customType: "persona-cue",
      content: `## Persona Guidance\n\n${cues.join("\n")}`
    });
  });
}

function generateCues(prompt: string): string[] {
  const cues: string[] = [];
  const lower = prompt.toLowerCase();
  
  if (lower.includes("explain")) cues.push("Be thorough and educational");
  if (lower.includes("quick")) cues.push("Be concise and direct");
  if (lower.includes("debug")) cues.push("Be systematic and precise");
  
  return cues;
}
```

---

## Skill Implementation Guide

### Constitution Structure

```markdown
# [Name] Constitution

## Core Principles
1. [Principle with reason]
2. [Principle with reason]
3. [Principle with reason]

## Decision Framework
Before any action, verify:
- Does this align with [Principle 1]?
- Is there a [risk category] I should consider?
- Have I consulted [relevant guidelines]?

## Boundaries
- DO NOT [specific prohibited action]
- DO NOT [specific prohibited action]
- DO [specific allowed action]

## Escalation
When uncertain:
1. Ask for clarification
2. Request human review
3. Document the issue
```

### Persona Structure

```markdown
# [Name] Persona

## Communication Style
- [Style characteristic 1]
- [Style characteristic 2]
- [Style characteristic 3]

## Tone
- [Tone description]

## Vocabulary
- Use: [preferred terms]
- Avoid: [terms to avoid]

## Response Patterns
- Greeting: [how to greet]
- Uncertainty: [how to express uncertainty]
- Closing: [how to close]

## Behavioral Guidelines
1. [Guideline 1]
2. [Guideline 2]
3. [Guideline 3]
```

---

## Memory System

### Session Memory

Store in session via `appendEntry()`:

```typescript
ctx.appendEntry("learned-facts", {
  fact: "Project uses TypeScript",
  timestamp: Date.now()
});
```

### Cross-Session Memory

File-based storage loaded on startup:

```
~/.meta-agent/memory/[employee-name].json
```

```json
{
  "learned-facts": [
    "Project uses TypeScript",
    "User prefers markdown formatting"
  ],
  "preferences": {
    "verbosity": "detailed"
  },
  "lastUpdated": 1699999999999
}
```

---

## Model Routing

### Simple Mode (Rules-based)

Keyword matching routes to models:

```typescript
const ROUTES = {
  quick: ["format", "lint", "spell", "typo", "comment", "rename"],
  reasoning: ["debug", "fix", "error", "issue", "refactor", "optimize"],
  strong: ["architect", "design", "plan", "complex", "system", "scale"]
};
```

### Advanced Mode (LLM-based)

Use a model to classify the task:

```typescript
const classification = await ctx.model.call("classify-task", {
  prompt: event.prompt
});
const model = routeToModel(classification.category);
```

---

## Loading Flow

```
1. User starts with employee config
   $ pi -e ./extensions/... --skill ./skills/...

2. Load extensions (in order)
   - model-router
   - memory
   - context-manager
   - persona

3. Load skills (by priority naming)
   - 00-CONSTITUTION-*.md (priority 1)
   - 10-PERSONA-*.md (priority 2)
   - 20-SKILL-*.md (priority 3)

4. Build system prompt
   - Compose constitution → persona → skills → context

5. Start Pi Agent
   - All extensions registered
   - All skills loaded
   - Ready for interaction
```

---

## Events Reference

### Lifecycle Events

| Event | Payload | Return | Description |
|-------|---------|--------|-------------|
| `session_start` | `{ reason }` | - | Session begins |
| `session_shutdown` | `{ reason }` | - | Session ends |
| `before_agent_start` | `{ prompt, images, systemPrompt }` | `{ message?, systemPrompt? }` | Before turn |
| `agent_start` | - | - | Agent starts |
| `agent_end` | `{ messages }` | - | Agent ends |

### Turn Events

| Event | Payload | Return | Description |
|-------|---------|--------|-------------|
| `turn_start` | `{ turnIndex }` | - | Turn begins |
| `turn_end` | `{ turnIndex, message, toolResults }` | - | Turn ends |
| `message_start` | `{ message }` | - | Message begins |
| `message_end` | `{ message }` | `{ message? }` | Message ends |

### Tool Events

| Event | Payload | Return | Description |
|-------|---------|--------|-------------|
| `tool_call` | `{ toolName, toolCallId, input }` | `{ block? }` | Before tool |
| `tool_result` | `{ toolName, toolCallId, content, isError }` | - | After tool |

---

## Security Considerations

- Extensions run with full system access
- Only install from trusted sources
- Review constitution before deployment
- Consider sandboxing for untrusted employees

---

## Future Enhancements

- [ ] Vector-based memory retrieval
- [ ] LLM-based model routing
- [ ] Multi-agent coordination
- [ ] Employee marketplace
- [ ] Version management
- [ ] Testing framework

---

## Contributing

1. Fork the repository
2. Create extension/skill/employee
3. Test with Pi Agent
4. Submit PR with documentation