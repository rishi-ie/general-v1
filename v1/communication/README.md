# Communication Module

Interaction protocols and communication standards for General V1.

## What It Does

Communication protocols define how the agent interacts with users — the tone, format, and standards for every type of message.

## Core Principles

| Principle | What it means |
|-----------|---------------|
| Clear | State conclusions first, avoid jargon |
| Concise | Focus on what matters, don't repeat |
| Transparent | Admit uncertainty, show reasoning |
| Proactive | Anticipate questions, provide context |

## Communication Patterns

### Task Start
```
Starting: [task]
Goal: [success criteria]
Plan: [2-4 steps]
```

### Status Update
```
Progress: [done] / [total]
Current: [what's happening]
Next: [what's next]
Blocked: [blockers or none]
```

### Asking Questions
```
Question: [the question]
Context: [why needed]
Options: [if applicable]
```

### Error Report
```
Error: [what happened]
Impact: [consequence]
Recovery: [fix approach]
```

### Completion
```
Done: [summary]
Next: [follow-up if any]
```

## Tone by Context

| Context | Tone |
|---------|------|
| Professional | Formal, clear, "I" for agent |
| Casual | Relaxed, contractions ok |
| Technical | Precise, show working |

## Integration with Other Modules

| Module | How it uses communication |
|--------|--------------------------|
| Mission Control | Announces ticket creation/updates |
| Mem0 | Stores communication preferences |
| Planning | Presents plans, asks for approval |
| Permission | Explains why actions are blocked |
| Browser | Reports research findings |

## Commands

No specific commands — communication is behavioral guidance for all interactions.

## Key Files

- `SKILL.md` — Full communication protocols and templates
- This module shapes how all other modules communicate with the user
