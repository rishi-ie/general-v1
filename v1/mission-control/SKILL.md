---
name: mission-control
description: File-based ticket tracking for persistent task memory. Creates and manages tickets in .mission-control/ as JSON files. Use when tracking work items, managing todos, or linking tasks to plan phases.
---

# Mission Control

Persistent ticket tracking that gives the agent long-term memory of what it's working on.

## Core Principle

Mission Control is the agent's **working memory for tasks**. It tracks **work items** — things that need to be done, are in progress, or have been completed.

## When to Use

**Explicit triggers:**
- User says "track this", "add to todo", "create a ticket"
- User assigns a task explicitly
- User asks "what tickets do we have?"

**Implicit triggers:**
- User describes work they want done
- User mentions a goal or objective
- Work is implied in conversation (confidence-based)

## Ticket Lifecycle

```
open → in_progress → done
```

| Status | Meaning |
|--------|---------|
| `open` | Not started, queued |
| `in_progress` | Actively being worked |
| `done` | Completed |

## Priority Levels

| Priority | When to use |
|----------|-------------|
| `critical` | Blocking, urgent |
| `high` | Important, time-sensitive |
| `medium` | Default for most tasks |
| `low` | Nice to have |

## Commands

| Command | When to use |
|---------|-------------|
| `/ticket new <title>` | Create a ticket explicitly |
| `/ticket list` | See all tickets |
| `/ticket list --status open` | Filter by status |
| `/ticket list --priority high` | Filter by priority |
| `/ticket show <id>` | Full ticket details |
| `/ticket update <id> --status in_progress` | Update status |
| `/ticket update <id> --priority high` | Update priority |
| `/ticket close <id>` | Mark done |
| `/ticket delete <id>` | Remove ticket |
| `/ticket link-plan <id> <phase>` | Link to plan phase |
| `/ticket import` | Import open phases from task_plan.md |

## Implicit Task Detection

The extension monitors conversation and detects tasks automatically:

- **Confidence ≥ 70%**: Ticket is created and announced
- **Confidence 50-70%**: You are prompted to confirm before creation
- **Confidence < 50%**: Skipped

When prompted: use `/ticket confirm <key>` to create, or ignore.

## Ticket Structure

```json
{
  "id": "MC-2025-06-20-abc123",
  "title": "Implement user authentication",
  "description": "Add OAuth2 login flow",
  "status": "open",
  "priority": "high",
  "created": "2025-06-20T10:00:00Z",
  "updated": "2025-06-20T14:30:00Z",
  "subtasks": [],
  "tags": [],
  "extras": {},
  "linked_plan": {
    "plan_path": "task_plan.md",
    "phase": "Phase 2: Auth"
  }
}
```

## Relationship to Planning

Mission Control and planning work together:

| Concern | Where |
|---------|-------|
| Work items and their status | Mission Control |
| Phases and execution order | task_plan.md |
| Research and discoveries | findings.md |
| Session progress | progress.md |

Use `/ticket import` to create tickets from open plan phases at the start of a session. Link tickets to phases with `/ticket link-plan <id> <phase>`.

## Storage

Tickets are stored as JSON files in `.mission-control/tickets/` in your project directory. The extension maintains an index at `.mission-control/index.json`.

## Session Start

At session start, the extension loads active tickets into context. You see:
- All open and in-progress tickets
- Their priorities and linked plan phases
- Who's working on what

If you need full details of a specific ticket: `/ticket show <id>`

## Best Practices

1. **Create tickets early** — when a task is mentioned, create a ticket before starting work
2. **Update status** — mark tickets `in_progress` when you start, `done` when complete
3. **Link to plan** — connect tickets to plan phases for traceability
4. **Use subtasks** — break complex tickets into subtask strings
5. **Import from plan** — start sessions by running `/ticket import` to pick up where you left off

## Examples

**Create a ticket:**
```
/ticket new "Implement login page" --priority high --desc "Add OAuth2 login with Google"
```

**Update a ticket:**
```
/ticket update MC-2025-06-20-abc123 --status in_progress
```

**Link to plan:**
```
/ticket link-plan MC-2025-06-20-abc123 "Phase 2: Frontend"
```

**Import from plan:**
```
/ticket import
```
