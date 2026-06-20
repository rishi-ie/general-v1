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
                            └── v1/modules/
                                    ├── planning/              ✅ Complete
                                    ├── browser/               ✅ Complete
                                    ├── docs/                  ✅ Intentional empty
                                    ├── identity/             ✅ Built during assembly
                                    ├── mem0/                 ✅ Complete (npm:@mem0/pi-agent-plugin)
                                    ├── mission-control/        ✅ Complete
                                    ├── permission/            ✅ Complete (npm:pi-permission-system)
                                    ├── communication/         ✅ Complete
                                    ├── display-stats/         ✅ Complete
                                    ├── sub-agent/            ✅ Complete
                                    └── sub-agent-context/    ✅ Complete
```

## Modules

| Module | Type | Status | Purpose |
|--------|------|--------|---------|
| `planning/` | Skill + Extension | ✅ | Manus-style file-based task planning |
| `browser/` | Skill + Extension | ✅ | Web browsing via browser-use |
| `identity/` | Skill | ✅ (assembly) | Name, role, communication style, boundaries |
| `docs/` | Skill | ✅ (intentional) | JD documentation — empty for general, filled per-domain |
| `mem0/` | Extension + Skill | ✅ | Persistent cross-session memory (via @mem0/pi-agent-plugin) |
| `mission-control/` | Extension + Skill | ✅ | Ticket tracking with LLM auto-capture |
| `permission/` | Extension + Skill | ✅ | Authority levels and approval workflows (via pi-permission-system) |
| `communication/` | Skill | ✅ | Interaction protocols and response standards |
| `display-stats/` | Skill | ✅ | Real-time performance metrics |
| `sub-agent/` | Extension + Skill | ✅ | Sub-agent spawning for parallel/specialized tasks |
| `sub-agent-context/` | Extension + Skill | ✅ | Cognitive layer — meta memory, decisions, goals, relationships |

## How It Works

1. **Build modules** — Each v1 module is a self-contained skill (markdown) or extension (TypeScript)
2. **Package** — All modules get composed into a system prompt for Pi Agent
3. **Deploy** — The result is a General V1 digital employee
4. **Specialize** — Add domain-specific modules on top to create Software Employee, Research Employee, etc.

## Module Dependencies

```
Mem0 (memory)
    ↑ used by
Sub-agent-context (cognitive layer)
    ↑ uses
Sub-agent (spawns sub-agents)
    ↑ used by
Mission Control (task tracking)
Planning (phase management)

Permission (authority levels)
    ↑ enforced by
pi-permission-system
```

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

## NPM Packages Used

Some modules integrate existing Pi Agent packages:

| Module | Package | Install command |
|--------|---------|----------------|
| mem0 | @mem0/pi-agent-plugin | `pi install npm:@mem0/pi-agent-plugin` |
| permission | pi-permission-system | `pi install npm:pi-permission-system` |

## Related

- [Meta Agent](./meta-agent/README.md) — Framework this is built on
- [Pi Agent](https://github.com/earendil-works/pi) — Runtime execution engine
- [@mem0/pi-agent-plugin](https://github.com/mem0ai/mem0/tree/main/integrations/pi-agent-plugin) — Mem0 integration
- [pi-permission-system](https://github.com/MasuRii/pi-permission-system) — Permission enforcement
