---
name: display-stats
description: Real-time performance metrics and activity statistics for the digital employee. Use when reporting session stats, showing task progress, or summarizing work completed.
---

# Display Stats

Real-time metrics that help users understand what the agent is doing and has done.

## Why Stats Matter

Stats provide:
- **Transparency** — See what the agent is working on
- **Progress tracking** — Measure completion
- **Resource awareness** — Understand cost and time
- **Trust** — Clear evidence of work done

## What to Track

### Session Stats

| Stat | Description | When to show |
|------|-------------|--------------|
| Session duration | Time since start | On request |
| Tokens used | Approximate cost | On request |
| Turns | Number of exchanges | On request |

### Task Stats

| Stat | Description | When to show |
|------|-------------|--------------|
| Active tickets | Current workload | Session start |
| Completed | Tasks done this session | On request |
| Created | Tasks created this session | On request |

### Activity Stats

| Stat | Description | When to show |
|------|-------------|--------------|
| Tools used | Commands run | On request |
| Files changed | Created/modified | On request |
| Research done | Pages browsed, searches | On request |

## Display Format

When reporting stats, use a clean format:

```
=== SESSION STATS ===
Duration: 45m
Turns: 12
Tokens: ~8K (approx $0.02)

=== TASK STATS ===
Active tickets: 3
Completed this session: 2
Created this session: 1

=== RECENT ACTIVITY ===
Files created: 5
Files modified: 12
Commands run: 28
Research queries: 3
```

## When to Report Stats

### On Request

When user asks "what have you done?" or "stats":
```
=== TODAY'S SUMMARY ===
Tasks completed: 4
Files changed: 23
Time active: 2h 15m
Most used tools: read (45), grep (32), write (18)
```

### Proactively

At session start if there are active tickets:
```
Session started. Active workload:
- [MC-xxx] "Implement auth" (in_progress)
- [MC-yyy] "Write tests" (open)
3 total tickets, 1 in progress.
```

At task completion:
```
Done. Created:
- src/auth/login.ts (185 lines)
- src/auth/logout.ts (42 lines)

Updated: src/auth/index.ts
```

## Key Metrics to Remember

### Efficiency Signals

- **Completion rate** — tasks done / tasks started
- **Tool efficiency** — useful tool calls vs total
- **Context utilization** — how well context is used

### Quality Signals

- **Error rate** — commands that failed
- **Revision rate** — files edited after first write
- **Research depth** — findings vs surface lookups

## Commands

| Command | When to use |
|---------|-------------|
| `/stats` | Show current session stats |
| `/stats today` | Show today's summary |
| `/stats all` | Show comprehensive stats |
| `/stats reset` | Reset session stats |

## Display Principles

1. **Be concise** — Only show what's relevant
2. **Be timely** — Report when it matters, not constantly
3. **Be honest** — Don't inflate positive stats
4. **Be clear** — Use labels, not abbreviations

## Context Integration

Stats should be available from:

| Source | What's tracked |
|--------|---------------|
| Mission Control | Tickets created, completed, updated |
| Mem0 | Memories stored, searches run |
| Planning | Phases completed, findings documented |
| Browser | Pages visited, data extracted |

## Example: End-of-Session Summary

```
=== SESSION SUMMARY ===
Duration: 1h 23m | Turns: 24 | Tokens: ~15K

=== COMPLETED ===
✓ Implement user authentication (Phase 2)
✓ Add session management
✓ Write auth tests

=== FILES ===
Created: 8 | Modified: 15 | Deleted: 0

=== TOOLS ===
Most used: read (67), write (24), grep (31), bash (18)

=== TICKETS ===
Created: 3 | Completed: 2 | Active: 4
```

## Relationship to Other Modules

| Module | Stats provided |
|--------|---------------|
| Mission Control | Ticket counts, completion status |
| Mem0 | Memory operations, recall accuracy |
| Planning | Phases completed, findings |
| Communication | Turn counts, response times |
