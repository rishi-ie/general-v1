#!/usr/bin/env python3
"""
Browser Wrapper for Agent
Allows the AI agent to run browser tasks via browser-use.

Usage:
    python3 browser-wrapper.py "Your task here"

The wrapper:
1. Reads configuration from config.yaml
2. Loads the browser profile
3. Runs the browser-use agent with the task
4. Returns the result
"""

import asyncio
import os
import sys
import yaml
from browser_use import Agent
from browser_use.browser import BrowserProfile


def load_config():
    """Load configuration from config.yaml"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(script_dir, 'config', 'config.yaml')

    if not os.path.exists(config_path):
        # Try parent directory
        config_path = os.path.join(script_dir, '..', 'config', 'config.yaml')

    with open(config_path, 'r') as f:
        return yaml.safe_load(f)


def get_profile(config):
    """Get or create browser profile"""
    profile_path = os.path.expanduser(config.get('profile_path', '~/.config/v1/browser-profiles'))
    profile_dir = os.path.join(profile_path, 'default')

    os.makedirs(profile_dir, exist_ok=True)

    browser_config = config.get('browser', {})

    return BrowserProfile(
        state_dir=profile_dir,
        headless=config.get('headless', False),
        browser_config={
            'width': browser_config.get('width', 1280),
            'height': browser_config.get('height', 720),
        }
    )


async def run_browser_task(task: str, config: dict) -> str:
    """Run a browser task and return the result"""
    profile = get_profile(config)

    # Determine model
    model = config.get('model', 'claude-sonnet-4-6')
    provider = config.get('provider', 'anthropic')

    # Create agent with appropriate LLM
    if provider == 'anthropic':
        from browser_use import ChatAnthropic
        llm = ChatAnthropic(model=model)
    elif provider == 'openai':
        from browser_use import ChatOpenAI
        llm = ChatOpenAI(model=model)
    else:
        from browser_use import ChatAnthropic
        llm = ChatAnthropic(model=model)

    agent = Agent(
        task=task,
        browser_profile=profile,
        llm=llm,
    )

    history = await agent.run()
    return history.final_result() or "No result returned"


def main():
    if len(sys.argv) < 2:
        print("Usage: browser-wrapper.py \"Your task here\"", file=sys.stderr)
        sys.exit(1)

    task = ' '.join(sys.argv[1:])

    try:
        config = load_config()
        result = asyncio.run(run_browser_task(task, config))
        print(result)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
