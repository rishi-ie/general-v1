---
name: permission
description: Permission system for controlling what the agent can do. Enforces tool, bash, and skill access policies. Use when checking if an action is allowed, or when user wants to configure permission levels.
---

# Permission System

Controls what the agent can do without asking, what requires confirmation, and what is blocked.

## Permission States

| State | Behavior |
|-------|----------|
| `allow` | Agent performs the action silently |
| `ask` | Agent asks for user confirmation first |
| `deny` | Agent blocks the action |

## Permission Levels

| Level | Description |
|-------|-------------|
| `read-only` | Read files, search. No writes, no commands. |
| `balanced` | Most actions allowed. Destructive actions ask or deny. |
| `open` | Most actions allowed. Only dangerous patterns ask. |

## Default Level: Balanced

### Balanced Policy Summary

**Allowed silently:**
- Reading files, searching, listing directories
- Git status, git diff, git log
- npm and node commands
- Most non-destructive operations

**Requires confirmation:**
- Writing or editing files
- Git add, git commit, git push
- curl/wget requests
- sudo commands

**Always blocked:**
- `rm -rf *` (destructive delete)
- Any `sudo rm` patterns

## Commands

| Command | When to use |
|---------|-------------|
| `/permission status` | Check current permission level |
| `/permission set balanced` | Switch to balanced mode |
| `/permission set read-only` | Switch to read-only mode |
| `/permission set open` | Switch to open mode |
| `/permission edit <tool> <action>` | Change a specific rule |
| `/permission reset` | Reset to default balanced |
| `/permission system` | Open settings modal |

## How Permissions Work

The permission system intercepts tool calls and bash commands before they execute:

1. Agent decides to call a tool
2. Permission system checks the policy
3. If `allow` → executes silently
4. If `ask` → prompts user for approval
5. If `deny` → blocks with error message

## When to Check Permissions

The agent should:

- **Always follow the permission policy** — don't try to work around it
- **Be transparent about permissions** — tell user when something requires approval
- **Proactively warn** — when about to do something potentially destructive
- **Ask before acting** — when uncertain about a permission level

## Proactive Permission Behavior

Even when a tool is `allow`ed, the agent should:

1. **Warn on destructive actions** — "This will permanently delete X. Proceeding."
2. **Confirm large changes** — "This will modify 50 files. Continue?"
3. **Check git status before push** — show what's being pushed
4. **Verify paths** — confirm target paths before write/edit

## Examples

**Check permission level:**
```
/permission status
```

**Switch to read-only:**
```
/permission set read-only
```

**Allow git push without asking:**
```
/permission edit git push allow
```

**Reset to defaults:**
```
/permission reset
```

## Emergency Actions

Even with strict permissions, the agent can always:
- Read any file in the project
- Show git status and diffs
- Search and find files
- Display help and documentation

These are the safety baseline — the agent should never be completely locked out from understanding the project state.

## Relationship to Other Modules

| Module | Permission interaction |
|--------|----------------------|
| Planning | Agent needs write permission to create plan files |
| Mission Control | Needs write to create/update tickets |
| Mem0 | Needs skill permission to load |
| Browser | Needs bash permission to run browser commands |
