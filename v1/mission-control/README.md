# Mission Control Module

File-based ticket tracking for General V1 — gives the agent persistent memory of what it's working on.

## What It Does

Mission Control provides a ticket system where each ticket tracks:
- Title, description, status, priority
- Subtasks (free-form)
- Tags (free-form)
- Linked plan phases
- Timestamps

Tickets are stored as JSON files in `.mission-control/` and actively maintained in context during work sessions.

## How It Works

The extension runs as a Pi Agent extension that:

1. **Loads active tickets at session start** — injected into context
2. **Maintains tickets in context during work** — updates as status changes
3. **Auto-captures tasks from conversation** — LLM inference on turn history
4. **Provides commands** — `/ticket new`, `/ticket list`, `/ticket update`, etc.

The SKILL.md provides behavioral guidance on when to create tickets and how to use them.

## Setup

No additional setup required — the extension loads automatically when configured in Meta Agent.

To use in a project:

```bash
cd /path/to/project
# Tickets will be stored in .mission-control/ in this directory
```

## Commands

| Command | Description |
|---------|-------------|
| `/ticket new <title>` | Create a new ticket |
| `/ticket list` | List all tickets |
| `/ticket show <id>` | Show full ticket details |
| `/ticket update <id> [--status] [--priority]` | Update ticket fields |
| `/ticket close <id>` | Mark ticket as done |
| `/ticket delete <id>` | Delete a ticket |
| `/ticket link-plan <id> <phase>` | Link to plan phase |
| `/ticket import` | Import open phases from task_plan.md |
| `/ticket confirm <key>` | Confirm auto-detected task |

## Storage Structure

```
.mission-control/
├── index.json              # ID → filename mapping
└── tickets/
    ├── MC-2025-06-20-abc123.json
    └── MC-2025-06-20-def456.json
```

## Auto-Capture

The extension monitors conversation and auto-detects tasks using LLM inference:

| Confidence | Action |
|------------|--------|
| ≥ 70% | Create ticket, announce |
| 50-70% | Prompt for confirmation |
| < 50% | Skip |

Use `/ticket confirm <key>` to confirm pending tasks.

## Integration with Planning

Mission Control works alongside the Planning module:

- `/ticket import` — imports open phases from `task_plan.md`
- Tickets can link to specific plan phases
- When a phase completes in planning, close the linked ticket

## Relationship to Other Modules

| Module | What it tracks |
|--------|---------------|
| Mission Control | Work items, tasks, todos |
| Planning | Execution phases, progress |
| Mission Control | Current work state |
