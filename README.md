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
                            └── v1/modules/ (what you're building)
                                    ├── planning/     ✅
                                    ├── browser/      ✅
                                    ├── docs/         ✅ (empty for general)
                                    ├── identity/     ✅ (built during assembly)
                                    ├── mem0/         🔧
                                    ├── mission-control/ 🔧
                                    ├── permission/   🔧
                                    ├── communication/🔧
                                    ├── display-stats/🔧
                                    └── sub-agent-context/ 🔧
```

## Modules

| Module | Type | Status | Purpose |
|--------|------|--------|---------|
| `planning/` | Skill + Extension | ✅ | Manus-style file-based task planning |
| `browser/` | Skill + Extension | ✅ | Web browsing via browser-use |
| `identity/` | Skill | ✅ (assembly) | Name, role, communication style, boundaries |
| `docs/` | Skill | ✅ (intentional) | JD documentation — empty for general, filled per-domain |
| `mem0/` | Extension | 🔧 | Persistent cross-session memory |
| `mission-control/` | Extension | 🔧 | Ticket tracking and task management |
| `permission/` | Extension | 🔧 | Authority levels and approval workflows |
| `communication/` | Extension | 🔧 | Interaction protocols |
| `display-stats/` | Extension | 🔧 | Real-time performance metrics |
| `sub-agent-context/` | Extension | 🔧 | Sub-agent orchestration |

## How It Works

1. **Build modules** — Each v1 module is a self-contained skill (markdown) or extension (TypeScript)
2. **Package** — All modules get composed into a system prompt for Pi Agent
3. **Deploy** — The result is a General V1 digital employee
4. **Specialize** — Add domain-specific modules on top to create Software Employee, Research Employee, etc.

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