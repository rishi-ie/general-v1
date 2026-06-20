# Permission Module

Permission enforcement for General V1, powered by [pi-permission-system](https://github.com/MasuRii/pi-permission-system).

## What It Does

The permission system controls what the agent can do without asking. It enforces policies on:

- **Tools** — read, write, edit, grep, find, ls, bash, task, etc.
- **Bash commands** — git, npm, shell commands
- **MCP operations** — MCP server and tool access
- **Skills** — which skills can be loaded
- **Special** — external directory access, doom loop detection

## Installation

The permission system is installed as a Pi Agent package:

```bash
pi install npm:pi-permission-system
```

## Configuration

### Default Policy Location

`~/.pi/agent/pi-permissions.jsonc`

### For General V1

A balanced default policy is provided in `config/pi-permissions.jsonc`. Copy it to your Pi agent directory:

```bash
cp v1/permission/config/pi-permissions.jsonc ~/.pi/agent/pi-permissions.jsonc
```

Or let the extension create its default and customize via commands.

## Permission Levels

| Level | Tools | Bash | Destructive |
|-------|-------|------|------------|
| `read-only` | Read-only | Ask for most | Deny |
| `balanced` | Allow most | Dangerous patterns ask | Key dangerous deny |
| `open` | Allow all | Ask for dangerous | Ask |

## Balanced Policy (Default)

```jsonc
{
  "defaultPolicy": {
    "tools": "ask",
    "bash": "ask",
    "mcp": "ask",
    "skills": "ask",
    "special": "ask"
  },
  "tools": {
    "read": "allow",
    "write": "ask",
    "edit": "ask",
    "grep": "allow",
    "find": "allow",
    "ls": "allow",
    "bash": "ask",
    "task": "ask"
  },
  "bash": {
    "git status": "allow",
    "git diff": "allow",
    "git log *": "allow",
    "npm *": "allow",
    "node *": "allow",
    "ls *": "allow",
    "pwd": "allow",
    "git add *": "ask",
    "git commit *": "ask",
    "git push *": "ask",
    "rm -rf *": "deny",
    "sudo *": "ask",
    "curl *": "ask",
    "wget *": "ask"
  }
}
```

## Commands

| Command | Description |
|---------|-------------|
| `/permission status` | Show current permission level |
| `/permission set <level>` | Set level: `read-only`, `balanced`, or `open` |
| `/permission edit <tool> <action>` | Change a specific rule (e.g., `git push allow`) |
| `/permission reset` | Reset to default balanced policy |
| `/permission system` | Open the settings modal |

## Changing Specific Rules

### Allow git push without asking
```
/permission edit git push allow
```

### Deny rm -rf commands
```
/permission edit rm -rf * deny
```

### Allow all git commands
```
/permission edit git * allow
```

## Policy File Format

The policy file uses JSONC (JSON with comments):

```jsonc
{
  // Default: ask for everything not explicitly matched
  "defaultPolicy": {
    "tools": "ask",
    "bash": "ask",
    "mcp": "ask",
    "skills": "ask",
    "special": "ask"
  },

  // Tool-specific rules (last match wins)
  "tools": {
    "read": "allow",
    "write": "ask",
    "grep": "allow"
  },

  // Bash command patterns (last match wins)
  "bash": {
    "git status": "allow",
    "git *": "ask",
    "rm -rf *": "deny"
  }
}
```

## How It Works

1. Agent prepares to call a tool or run a bash command
2. Permission system intercepts the call
3. Looks up the matching rule in the policy
4. If `allow` → executes
5. If `ask` → shows confirmation dialog, waits for user
6. If `deny` → blocks with error message

## Proactive Behavior

Even when a tool is allowed, the agent should:

- **Warn before destructive actions** — "This will permanently delete X"
- **Confirm large changes** — "This will modify 50 files"
- **Show git status before push** — let user review what's being pushed
- **Verify paths** — confirm target paths before writes

## Related Modules

| Module | Permission needs |
|--------|-----------------|
| Planning | Write access for plan files |
| Mission Control | Write access for tickets |
| Mem0 | Skill permission to load memory skills |
| Browser | Bash permission for browser commands |

## See Also

- [pi-permission-system](https://github.com/MasuRii/pi-permission-system) — Full documentation
- [Pi Agent Extensions](https://pi.dev) — Extension system overview
