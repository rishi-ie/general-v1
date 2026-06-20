# Browser Capability

Persistent browser sessions for web access and automation.

## Overview

This component enables the digital employee to browse the web with persistent logged-in sessions. Built on [browser-use](https://github.com/browser-use/browser-use), it provides AI-driven browser automation with session persistence.

## Features

- **Persistent Sessions** - Log in once, reuse cookies and sessions
- **AI-Driven** - Natural language instructions for browser tasks
- **Profile Management** - Separate profiles for different contexts
- **Configurable** - Customize model, path, and browser settings

## Prerequisites

- Python >= 3.11
- `browser-use` package: `pip install browser-use`
- An LLM API key (Anthropic, OpenAI, or Google)

## Setup

### 1. Install Dependencies

```bash
pip install browser-use
```

### 2. Configure

Edit `config/config.yaml`:

```yaml
profile_path: "~/.config/v1/browser-profiles"
headless: false
model: "claude-sonnet-4-6"
provider: "anthropic"
```

### 3. Create Profile

```bash
./setup-profile.sh
```

This will:
- Launch a browser with a fresh profile
- You log into websites you need (GitHub, Gmail, etc.)
- Close browser when done - profile auto-saves

### 4. Set API Key

```bash
export ANTHROPIC_API_KEY="sk-ant-..."  # or BROWSER_USE_API_KEY
```

## Usage

### From Command Line

```bash
python3 wrapper/browser-wrapper.py "Find the pricing page for cursor.com"
```

### From Agent

The agent uses the wrapper automatically when browsing tasks are needed.

### Example Tasks

- Research competitors
- Extract data from websites
- Check notifications on logged-in sites
- Fill out web forms
- Navigate multi-step web workflows

## Profile Management

### Default Profile Location

```
~/.config/v1/browser-profiles/default/
```

### Reset Profile

To start fresh:

```bash
rm -rf ~/.config/v1/browser-profiles/default
./setup-profile.sh
```

### Multiple Profiles (Future)

The configuration supports multiple profiles for different contexts:

```
~/.config/v1/browser-profiles/
├── default/      # Default profile
├── work/         # Work-specific logins
├── personal/     # Personal logins
```

## Configuration Reference

### config.yaml

| Setting | Default | Description |
|---------|---------|-------------|
| `profile_path` | `~/.config/v1/browser-profiles` | Where profiles are stored |
| `headless` | `false` | Run without visible window |
| `model` | `claude-sonnet-4-6` | LLM model for agent |
| `provider` | `anthropic` | LLM provider |
| `browser.width` | `1280` | Browser window width |
| `browser.height` | `720` | Browser window height |

## Security Notes

- Profile contains sensitive cookies and session data
- Profile directory should have appropriate access controls
- Do not share profile directories without understanding the data they contain
- Clear profile data when no longer needed

## Troubleshooting

### Browser doesn't launch

1. Check Python version: `python3 --version` (need 3.11+)
2. Install browser-use: `pip install browser-use`
3. Install Playwright browsers: `playwright install chromium`

### Profile not loading

1. Verify profile path exists
2. Check profile directory has read/write permissions
3. Try recreating profile: `rm -rf ~/.config/v1/browser-profiles/default && ./setup-profile.sh`

### API errors

1. Verify API key is set correctly
2. Check key has sufficient credits/permissions
3. Try different model in config

## See Also

- [browser-use GitHub](https://github.com/browser-use/browser-use)
- [browser-use Documentation](https://docs.browser-use.com)
