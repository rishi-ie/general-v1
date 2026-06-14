# Meta Agent

Transform Pi Agent into a **digital employee factory**. Create specialized employees with their own personality, knowledge, and behavior in minutes.

## What is this?

A framework for creating **digital employees** - AI assistants configured for specific roles. Each employee has:

- **Constitution** - Core principles and rules that never change
- **Persona** - Communication style, tone, and behavioral patterns
- **Skills** - Domain knowledge and capabilities
- **Extensions** - Custom tools and behaviors via code
- **Prompts** - Extra instructions injected into system prompt

**The modular design means:** Swap constitutions, personas, or extensions to create entirely new employees. No code changes needed - just edit markdown files.

## How Modularity Works

### Skills (Markdown Files)

Knowledge loaded into the system prompt. Edit a `.md` file = employee learns new behavior.

```
skills/
├── constitutions/00-CONSTITUTION-medical.md   # "Never recommend medication"
├── personas/10-PERSONA-medical.md             # "Use empathetic, clear language"
└── domain/20-SKILL-cardiology.md             # "Cardiac anatomy, treatments, protocols"
```

### Extensions (TypeScript Files)

Custom code that runs in Pi Agent. Subscribe to events, register tools, modify behavior.

```typescript
export default function myExtension(pi) {
  pi.on("before_agent_start", async (event, ctx) => {
    // Custom routing, memory, context management
  });
}
```

### Prompts (Markdown Files)

Extra system instructions appended on launch.

## Creating a New Employee

1. **Copy meta-agent repo** to `my-employee/`
2. **Edit constitution** - `skills/constitutions/00-CONSTITUTION-my-role.md`
3. **Edit persona** - `skills/personas/10-PERSONA-my-role.md`
4. **Add domain skills** - `skills/domain/20-SKILL-my-domain.md`
5. **Configure extensions** - Edit or add `.ts` files in `extensions/`
6. **Set API key** - `auth.json`
7. **Run** - `./run.sh`

New employee ready in under 10 minutes.

## Use Cases

| Employee | Constitution Focus | Persona | Skills |
|----------|-------------------|---------|--------|
| Medical Assistant | No diagnoses, safety first | Empathetic, clear | Medical protocols |
| Code Reviewer | Security, best practices | Direct, precise | Language-specific |
| Research Analyst | Citations, accuracy | Thorough, skeptical | Research methodology |
| Customer Support | Policy compliance | Friendly, patient | Product knowledge |

## Quick Start

```bash
git clone https://github.com/rishi-ie/meta-agent.git
cd meta-agent
cp meta-agent-config/auth.json.example meta-agent-config/auth.json
# Edit auth.json - add your API key
./run.sh
```

## Auto-Detection

Fill in one API key and the system auto-selects provider and model:

| Provider | Model |
|----------|-------|
| Anthropic | claude-sonnet-4-5 |
| Google | gemini-2.5-flash |
| OpenAI | gpt-4o |
| DeepSeek | deepseek-chat |
| Groq | llama-3.3-70b-versatile |

## Project Structure

```
meta-agent/
├── pi/                    # Pi Agent (cloned automatically)
├── meta-agent-config/     # Your employee configuration
│   ├── auth.json         # API keys
│   ├── settings.json     # Provider, model
│   ├── config.json       # Which modules to load
│   ├── extensions/       # Custom behavior (.ts)
│   └── skills/           # Knowledge (.md)
├── .pi/                   # Local state (gitignored)
└── run.sh                 # Launch script
```

## Architecture

See [architecture.md](./architecture.md) for technical details on extensions, events, and integration.

## License

MIT
