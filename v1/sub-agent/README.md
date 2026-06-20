# Sub-Agent Module

Sub-agent spawning and management for General V1.

## What It Does

Sub-agents allow the main agent to spawn additional agent instances for:
- Parallel execution of independent tasks
- Specialized focus on specific subtasks
- Research exploration in multiple directions

## How It Works

The sub-agent extension registers commands for spawning and managing sub-agents:

1. **Spawn** — `/subagent new <task>`
2. **Monitor** — `/subagent list`, `/subagent status <id>`
3. **Collect** — `/subagent results <id>`
4. **Terminate** — `/subagent kill <id>`

## When to Use

### Parallel Tasks

When a task has independent parts:
- Research multiple competitors
- Implement multiple features in parallel
- Process multiple data sources

### Specialized Knowledge

When a subtask needs focused attention:
- Deep research on a specific topic
- Specialized implementation work
- Detailed analysis

### Task Decomposition

Breaking complex work:
- Frontend/backend/database in parallel
- Multiple research directions
- Independent feature development

## Architecture

```
sub-agent/
├── SKILL.md                    # Usage guidance
├── README.md                   # This file
└── extensions/
    └── sub-agent/
        ├── index.ts            # Entry point
        ├── runtime.ts          # Sub-agent management
        ├── types.ts            # Sub-agent types
        └── package.json
```

## Commands

| Command | Description |
|---------|-------------|
| `/subagent new <task>` | Spawn a new sub-agent |
| `/subagent list` | List all active sub-agents |
| `/subagent status <id>` | Check sub-agent status |
| `/subagent results <id>` | Get sub-agent results |
| `/subagent kill <id>` | Terminate a sub-agent |

## Use Cases

### Parallel Research

```
/subagent new "Research competitor pricing for A"
/subagent new "Research competitor pricing for B"
/subagent new "Research competitor pricing for C"
```

### Specialized Implementation

```
/subagent new "Implement user authentication module"
/subagent new "Implement payment processing module"
```

### Research Branches

```
/subagent new "Explore PostgreSQL for this use case"
/subagent new "Explore MongoDB for this use case"
/subagent new "Explore Neo4j for this use case"
```

## Best Practices

1. **Define tasks clearly** — Specific scope and success criteria
2. **Limit parallelism** — 3-5 sub-agents max
3. **Collect results** — Always retrieve and integrate outputs
4. **Handle failures** — Graceful error handling for sub-agent issues
5. **Terminate when done** — Clean up resources

## Integration with Other Modules

Sub-agents can use other General V1 modules:

| Module | Sub-agent capability |
|--------|---------------------|
| Planning | Create and update plan files |
| Mission Control | Create and update tickets |
| Mem0 | Store and recall memories |
| Browser | Research and data extraction |

## Limitations

- Shared context window constraints
- Coordination overhead for dependent tasks
- Sub-agents require explicit result collection
