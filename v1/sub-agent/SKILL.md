---
name: sub-agent
description: Spawns and manages sub-agents for parallel or specialized task execution. Use when a task can be broken into independent parts, or when specialized knowledge is needed for a subtask.
---

# Sub-Agent

Spawns sub-agents to handle independent tasks in parallel or with specialized focus.

## When to Use Sub-Agents

**Use sub-agents when:**
- A task has independent subtasks that can run simultaneously
- Specialized knowledge is needed for a portion of work
- A long-running task can be decomposed
- Multiple research directions need exploration at once

**Don't use sub-agents when:**
- Tasks are sequential and depend on each other
- The overhead of coordination exceeds the benefit
- Simple, quick tasks that the main agent can handle

## Sub-Agent Patterns

### Parallel Execution

When multiple independent tasks exist:
```
Main agent: Breaks task into subtasks
Sub-agent 1: Handles subtask A
Sub-agent 2: Handles subtask B
Sub-agent 3: Handles subtask C
Main agent: Aggregates results
```

### Specialized Focus

When a subtask needs specialized knowledge:
```
Main agent: Identifies specialized need
Sub-agent [domain]: Handles specialized portion
Main agent: Integrates specialized work
```

### Research Branches

When exploring multiple options:
```
Main agent: Defines research scope
Sub-agent 1: Research option A
Sub-agent 2: Research option B
Sub-agent 3: Research option C
Main agent: Compares and decides
```

## Commands

| Command | When to use |
|---------|-------------|
| `/subagent new <task description>` | Spawn a new sub-agent |
| `/subagent list` | List active sub-agents |
| `/subagent status <id>` | Check sub-agent status |
| `/subagent kill <id>` | Terminate a sub-agent |
| `/subagent results <id>` | Get sub-agent results |

## Sub-Agent Lifecycle

1. **Spawn** — Create with task description
2. **Run** — Sub-agent executes independently
3. **Report** — Sub-agent returns results
4. **Integrate** — Main agent uses results
5. **Close** — Sub-agent completes or is terminated

## Best Practices

### Task Definition

- Clear, focused task description
- Specific success criteria
- Appropriate scope (not too large, not too small)

### Result Handling

- Always collect and integrate results
- Handle sub-agent failures gracefully
- Report sub-agent outputs to user

### Resource Management

- Don't spawn excessive sub-agents (max 3-5)
- Terminate sub-agents when done
- Monitor sub-agent status

## Examples

**Parallel research:**
```
/subagent new "Research competitor A's pricing model"
/subagent new "Research competitor B's pricing model"
/subagent new "Research competitor C's pricing model"
```

**Specialized implementation:**
```
/subagent new "Implement database schema for user auth"
```

**Complex task decomposition:**
```
Main breaks down:
- Sub-agent: Frontend components
- Sub-agent: Backend API
- Sub-agent: Database schema
- Main: Integration and testing
```

## Relationship to Other Modules

| Module | Sub-agent integration |
|--------|----------------------|
| Planning | Sub-agents can create plan files |
| Mission Control | Sub-agents update tickets |
| Mem0 | Sub-agents can store/recall memories |
| Browser | Sub-agents can do research |

## Limitations

- Sub-agents share the same context window limitations
- Coordination overhead for dependent tasks
- Results must be explicitly retrieved
