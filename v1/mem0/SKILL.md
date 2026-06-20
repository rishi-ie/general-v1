---
name: mem0-memory
description: Persistent semantic memory powered by Mem0. Use to store facts, preferences, decisions, and learnings that persist across sessions. Automatically captures from conversations. Search with /mem0-search, remember with /mem0-remember.
---

# Mem0 Memory

Persistent semantic memory that learns from every conversation and persists across sessions.

## Core Principle

**Memory is the agent's long-term knowledge layer.** Unlike planning files (which track work), memory tracks what the agent learns about the user, their preferences, decisions made, and ongoing context.

## Memory Categories

| Category | What to store |
|----------|---------------|
| `identity` | User's background, role, who they are |
| `preferences` | Likes, dislikes, preferred tools, working style |
| `goals` | Current objectives, targets, aspirations |
| `projects` | Ongoing work, initiatives, areas of focus |
| `decisions` | Choices made with rationale and trade-offs |
| `technical` | Tools, configs, technical knowledge |
| `relationships` | People, teams, stakeholders |
| `routines` | Recurring patterns, workflows |
| `lessons` | Insights learned, mistakes to avoid |
| `work` | Professional context, responsibilities |

## When to Use Memory

**Proactively (before starting work):**
- Load relevant memories at session start via `/mem0-tour` or context-loader
- Search memory when starting a task in a domain you've worked on before
- Check for past decisions before making new ones

**Reactively (after events):**
- User says "remember that..." or "store this..."
- A decision is made — store the rationale
- A lesson is learned — store what you'd do differently
- User preference is expressed — store it
- A project or goal is mentioned — store it

## Relationship to Planning

| Concern | Where it lives |
|---------|----------------|
| What work needs doing | `task_plan.md` / Mission Control |
| What you've learned/researched | `findings.md` |
| What happened in the session | `progress.md` |
| User preferences, decisions, context | Mem0 Memory |

Memory and planning are complementary — memory persists across sessions, planning files track work within a session.

## Privacy Guidelines

- **Store only what matters** — not every detail, only useful knowledge
- **No sensitive data** — don't store passwords, API keys, personal identifying info beyond what's useful
- **Respect deletions** — if user asks to forget something, honor it via `/mem0-forget`
- **Project-scoped by default** — memories are scoped to the git repository root

## Commands Reference

| Command | When to use |
|---------|-------------|
| `/mem0-remember <text>` | User asks to store something verbatim |
| `/mem0-search <query>` | Quick lookup of a specific topic |
| `/mem0-tour` | Browse all memories by category |
| `/mem0-forget <query>` | Delete memories matching query |
| `/mem0-dream` | Consolidate and prune memories |
| `/mem0-pin <query>` | Protect important memories from pruning |
| `/mem0-scope <scope>` | Switch between project/session/global |
| `/mem0-status` | Check memory health and count |

## Proactive Memory Habits

Before starting work on a known project:
```
/mem0-search <project name>
```

After making a significant decision:
```
/mem0-remember Decided to use PostgreSQL over MongoDB for this project. Reason: better relational integrity for our data model.
/mem0-remember User prefers detailed explanations upfront, not iterative discovery.
```

When a task reveals user preferences:
```
/mem0-remember User likes to see the full diff before approving changes.
```
