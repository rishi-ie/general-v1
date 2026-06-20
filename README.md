# General V1

A **general-purpose digital employee** built on [Meta Agent](./meta-agent/README.md) — designed to be the most powerful modular AI employee framework, capable of specializing into any domain.

## What It Is

General V1 is a **modular digital employee factory**. Instead of a monolithic agent, it's a collection of interchangeable modules (skills + extensions) that get packaged into a system prompt for Pi Agent. The result is a robust general employee that can be extended into domain-specific employees (software, research, web, etc.).

## The Stack

```
You (builder)
    └── General V1 (base employee)
            └── Meta Agent (framework)
                    └── Pi Agent (runtime)
                            └── v1/
                                    ├── planning/              ✅ Complete
                                    ├── browser/               ✅ Complete
                                    ├── docs/                  ✅ Intentional empty
                                    ├── identity/              ✅ Built during assembly
                                    ├── mem0/                  ✅ (@mem0/pi-agent-plugin)
                                    ├── mission-control/       ✅ Complete
                                    ├── permission/            ✅ (pi-permission-system)
                                    ├── sub-agent/            ✅ (@tintinweb/pi-subagents)
                                    ├── communication/         🔧 Needs planning
                                    ├── display-stats/         🔧 Needs planning
                                    └── sub-agent-context/     🔧 Needs planning
```

## Modules

| Module | Type | Status | Purpose |
|--------|------|--------|---------|
| `planning/` | Extension + Skill | ✅ | Manus-style file-based task planning |
| `browser/` | Extension + Skill | ✅ | Web browsing via browser-use |
| `identity/` | Skill | ✅ | Name, role, communication style, boundaries |
| `docs/` | Skill | ✅ | JD documentation — empty for general, filled per-domain |
| `mem0/` | Skill + Config | ✅ | Persistent memory via @mem0/pi-agent-plugin |
| `mission-control/` | Extension + Skill | ✅ | Ticket tracking with LLM auto-capture |
| `permission/` | Skill + Config | ✅ | Authority levels via pi-permission-system |
| `sub-agent/` | Extension + Skill | ✅ | Sub-agent spawning via @tintinwork/pi-subagents |
| `communication/` | Skill | 🔧 | Interaction protocols — needs planning |
| `display-stats/` | Skill | 🔧 | Real-time metrics — needs planning |
| `sub-agent-context/` | Extension + Skill | 🔧 | Cognitive layer — needs planning |

## How It Works

1. **Build modules** — Each v1 module is a self-contained skill (markdown) or extension (TypeScript)
2. **Package** — All modules get composed into a system prompt for Pi Agent
3. **Deploy** — The result is a General V1 digital employee
4. **Specialize** — Add domain-specific modules on top to create Software Employee, Research Employee, etc.

## NPM Packages Used

| Module | Package | Source |
|--------|---------|--------|
| mem0 | @mem0/pi-agent-plugin | npm (pi install) |
| permission | pi-permission-system | npm (pi install) |
| sub-agent | @tintinweb/pi-subagents | Cloned locally |

## Running

```bash
cd meta-agent
cp meta-agent-config/auth.json.example meta-agent-config/auth.json
# Add your API keys
./run.sh
```

## Creating Domain Employees

General V1 is the base. To create a domain employee:

```bash
# Example: Software Employee
cp -r meta-agent meta-agent-configs/software-v1
# Add software-specific skills, extensions, prompts
# Update config.json
./run.sh --config meta-agent-configs/software-v1/config.json
```

## Related

- [Meta Agent](./meta-agent/README.md) — Framework this is built on
- [Pi Agent](https://github.com/earendil-works/pi) — Runtime execution engine
- [@mem0/pi-agent-plugin](https://github.com/mem0ai/mem0/tree/main/integrations/pi-agent-plugin) — Mem0 integration
- [pi-permission-system](https://github.com/MasuRii/pi-permission-system) — Permission enforcement
- [@tintinweb/pi-subagents](https://github.com/tintinweb/pi-subagents) — Sub-agent spawning
