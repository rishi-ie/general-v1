#!/bin/bash

# Browser Profile Setup Script
# Run this once to set up your browser profile with logged-in sessions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/config/config.yaml"
PROFILE_PATH="${BROWSER_PROFILE_PATH:-$(grep 'profile_path:' "$CONFIG_FILE" | cut -d' ' -f2 | sed 's/~//g' | xargs -I{} echo "$HOME{}")}"

echo "=== Browser Profile Setup ==="
echo ""
echo "This script will:"
echo "1. Create a browser profile directory"
echo "2. Launch a browser"
echo "3. You'll log into websites you need"
echo "4. Close the browser when done - profile auto-saves"
echo ""
echo "Profile path: $PROFILE_PATH"
echo ""

# Create profile directory if it doesn't exist
mkdir -p "$PROFILE_PATH/default"

# Check if Python and browser-use are installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not installed."
    exit 1
fi

# Check if browser-use is installed
if ! python3 -c "import browser_use" 2>/dev/null; then
    echo "Installing browser-use..."
    pip install browser-use
fi

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ] && [ -z "$BROWSER_USE_API_KEY" ]; then
    echo "Warning: No API key detected."
    echo "Set ANTHROPIC_API_KEY or BROWSER_USE_API_KEY environment variable."
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "Launching browser with fresh profile..."
echo "Please log into the websites you need."
echo "Close the browser when you're done."
echo ""

# Launch browser with browser-use
python3 << 'EOF'
import asyncio
from browser_use import Agent
from browser_use.browser import BrowserProfile
import os
import yaml

async def main():
    # Load config
    config_path = os.path.join(os.path.dirname(__file__), 'config', 'config.yaml')
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)

    profile_path = os.path.expanduser(config.get('profile_path', '~/.config/v1/browser-profiles'))
    profile_dir = os.path.join(profile_path, 'default')

    profile = BrowserProfile(
        state_dir=profile_dir,
        headless=False,  # Always show browser during setup
    )

    agent = Agent(
        task="Open a browser and wait. The user will log into websites they need. After logging in, just confirm: 'Profile ready. You can close this browser.'",
        browser_profile=profile,
    )

    history = await agent.run()
    print(f"\nFinal result: {history.final_result()}")

if __name__ == "__main__":
    asyncio.run(main())
EOF

echo ""
echo "Profile setup complete!"
echo "Profile saved at: $PROFILE_PATH/default"
echo ""
echo "You can now use the browser agent for web tasks."
