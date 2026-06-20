# Display Stats Module

Real-time performance metrics and activity statistics for General V1.

## What It Does

Display stats provides standards for reporting what the agent is doing and has done — giving users transparency into the agent's work.

## What Gets Tracked

| Category | Metrics |
|----------|---------|
| Session | Duration, turns, tokens used |
| Tasks | Active tickets, completed, created |
| Activity | Tools used, files changed, research done |

## Display Format

Stats are shown in a clean, scannable format:

```
=== SESSION STATS ===
Duration: 45m
Turns: 12
Tokens: ~8K

=== TASK STATS ===
Active tickets: 3
Completed: 2
```

## When Stats Are Reported

| Timing | What |
|--------|------|
| Session start | Active workload summary |
| On request | Full session stats |
| Task completion | What was done |
| End of session | Comprehensive summary |

## Commands

| Command | Description |
|---------|-------------|
| `/stats` | Current session stats |
| `/stats today` | Today's summary |
| `/stats all` | Comprehensive stats |
| `/stats reset` | Reset session stats |

## Stats Sources

Stats come from integration with other modules:

| Module | Data provided |
|--------|---------------|
| Mission Control | Ticket counts, status changes |
| Mem0 | Memory operations, recall stats |
| Planning | Phase progress, findings count |
| Extension hooks | Tool usage, turn counts |

## Integration Points

Display stats uses data from:
- Session events (turn count, duration)
- Mission Control (ticket updates)
- Planning extension (phase completion)
- Mem0 extension (memory operations)

## Best Practices

1. **Report proactively** — At session start and task completion
2. **Be concise** — Only show relevant metrics
3. **Use consistent format** — Same structure every time
4. **Be honest** — Don't hide errors or failures

## Example Output

```
=== SESSION SUMMARY ===
Duration: 1h 23m | Turns: 24 | Tokens: ~15K

=== COMPLETED ===
✓ Implement user authentication
✓ Add session management
✓ Write auth tests

=== FILES ===
Created: 8 | Modified: 15

=== TICKETS ===
Active: 4 | Completed: 2 | Created: 3
```
