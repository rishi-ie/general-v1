---
name: browser
description: Enables web browsing capabilities for research, data extraction, and website interaction. Use when asked to look up information online, access websites, extract data from web pages, or interact with web-based services. Handles persistent sessions with logged-in profiles.
---

# Browser Skill

Access the web using browser-use with persistent logged-in sessions.

## Setup (One-Time)

Before first use, run the profile setup:

```bash
cd v1/browser
./setup-profile.sh
```

This will:
1. Launch a browser with a fresh profile
2. Allow you to log into websites (GitHub, Gmail, etc.)
3. Save the profile for future use

## Usage

When you need to browse the web, use the browser wrapper:

```bash
python3 v1/browser/wrapper/browser-wrapper.py "Your task here"
```

### Example Tasks

- "Find the pricing page for cursor.com"
- "Extract all job listings from linkedin.com/jobs"
- "Check if my GitHub repo has any open issues"
- "Research competitors for fintech startups"

## Configuration

Edit `v1/browser/config/config.yaml` to customize:

```yaml
profile_path: "~/.config/v1/browser-profiles"
headless: false
model: "claude-sonnet-4-6"
```

## When to Use Browser

**Use browser for:**
- Research and information gathering
- Extracting data from websites
- Accessing pages requiring login
- Multi-step web workflows
- Current information (post-training cutoff)

**Skip browser for:**
- Simple factual queries (likely in training data)
- Local file operations
- API-accessible services (use API if available)
- Speed-critical simple tasks

## Security Considerations

- Browser runs with your logged-in session
- Do NOT enter credentials directly - use the setup script
- Store findings in `findings.md` after research
- Clear sensitive data from memory after use

## Profile Management

- Profile is stored at configured `profile_path`
- Setup script creates a "default" profile
- Agent loads this profile automatically
- To reset profile: delete the profile folder and re-run setup
