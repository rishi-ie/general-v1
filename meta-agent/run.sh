#!/bin/bash

# Meta Agent Launch Script
# All state stored locally in .pi folder

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR/meta-agent-config"
PI_DIR="$SCRIPT_DIR/pi"
LOCAL_PI_DIR="$SCRIPT_DIR/.pi"

# Run setup if needed (safe to run every time)
if [ ! -f "$SCRIPT_DIR/.setup-complete" ]; then
    echo "[run] Running first-time setup..."
    "$SCRIPT_DIR/setup.sh"
    touch "$SCRIPT_DIR/.setup-complete"
    echo "[run] Setup complete."
fi

# Check if pi directory exists, clone if missing
if [ ! -d "$PI_DIR" ]; then
    echo "Cloning Pi Agent..."
    git clone https://github.com/earendil-works/pi.git "$PI_DIR"
fi

# Check if node_modules exists, install if missing
if [ ! -d "$PI_DIR/node_modules" ]; then
    echo "Installing Pi Agent dependencies..."
    cd "$PI_DIR" && npm install --ignore-scripts
fi

# Go back to script directory
cd "$SCRIPT_DIR"

# Check if pi-test.sh exists
if [ ! -f "$PI_DIR/pi-test.sh" ]; then
    echo "Error: pi-test.sh not found at $PI_DIR/pi-test.sh"
    exit 1
fi

# Create local .pi directory structure
mkdir -p "$LOCAL_PI_DIR/agent/sessions"
mkdir -p "$LOCAL_PI_DIR/agent/bin"
mkdir -p "$LOCAL_PI_DIR/agent/prompts"

# Auto-detect provider and model from auth.json
if [ -f "$CONFIG_DIR/auth.json" ]; then
    # Find first provider with an API key
    DETECTED_PROVIDER=""
    DETECTED_MODEL=""
    
    # Check each provider for a filled API key
    for provider in anthropic google openai deepseek groq mistral openrouter together; do
        KEY=$(jq -r ".$provider.key // \"\" " "$CONFIG_DIR/auth.json" 2>/dev/null)
        if [ -n "$KEY" ] && [ "$KEY" != "" ]; then
            DETECTED_PROVIDER="$provider"
            break
        fi
    done
    
    # Set default model based on provider
    case "$DETECTED_PROVIDER" in
        "anthropic")
            DETECTED_MODEL="claude-sonnet-4-5"
            ;;
        "google")
            DETECTED_MODEL="gemini-2.5-flash"
            ;;
        "openai")
            DETECTED_MODEL="gpt-4o"
            ;;
        "deepseek")
            DETECTED_MODEL="deepseek-chat"
            ;;
        "groq")
            DETECTED_MODEL="llama-3.3-70b-versatile"
            ;;
        "mistral")
            DETECTED_MODEL="mistral-large-latest"
            ;;
        "openrouter")
            DETECTED_MODEL="anthropic/claude-3.5-sonnet"
            ;;
        "together")
            DETECTED_MODEL="meta-llama/Llama-3.3-70B-Instruct"
            ;;
        *)
            DETECTED_PROVIDER=""
            DETECTED_MODEL=""
            ;;
    esac
    
    # Override settings.json with detected values (if not already set)
    if [ -n "$DETECTED_PROVIDER" ]; then
        echo "Detected provider: $DETECTED_PROVIDER"
        echo "Detected model: $DETECTED_MODEL"
        
        # Create a temporary settings with auto-detected values
        cat > "$LOCAL_PI_DIR/agent/settings.json.tmp" << EOF
{
  "lastChangelogVersion": "0.78.0",
  "defaultProvider": "$DETECTED_PROVIDER",
  "defaultModel": "$DETECTED_MODEL",
  "defaultThinkingLevel": "medium"
}
EOF
        # Copy auth.json
        cp "$CONFIG_DIR/auth.json" "$LOCAL_PI_DIR/agent/auth.json"
        
        # Use the auto-detected settings
        cp "$LOCAL_PI_DIR/agent/settings.json.tmp" "$LOCAL_PI_DIR/agent/settings.json"
        rm -f "$LOCAL_PI_DIR/agent/settings.json.tmp"
    fi
else
    # No auth.json, just copy settings if exists
    if [ -f "$CONFIG_DIR/settings.json" ]; then
        if [ ! -f "$LOCAL_PI_DIR/agent/settings.json" ] || \
           [ "$CONFIG_DIR/settings.json" -nt "$LOCAL_PI_DIR/agent/settings.json" ]; then
            cp "$CONFIG_DIR/settings.json" "$LOCAL_PI_DIR/agent/settings.json"
        fi
    fi
fi

# Set environment variables to use local folder
export PI_CODING_AGENT_DIR="$LOCAL_PI_DIR/agent"
export PI_CODING_AGENT_SESSION_DIR="$LOCAL_PI_DIR/agent/sessions"

# Add local bin to PATH (for fd, ripgrep, etc.)
export PATH="$LOCAL_PI_DIR/agent/bin:$PATH"

# Build the pi command
CMD="$PI_DIR/pi-test.sh"

# Load extensions
if [ -f "$CONFIG_DIR/config.json" ]; then
    while IFS= read -r ext; do
        if [ -n "$ext" ]; then
            CMD="$CMD -e \"$CONFIG_DIR/$ext\""
        fi
    done < <(jq -r '.extensions[]' "$CONFIG_DIR/config.json" 2>/dev/null)

    # Load skills (--skill flag)
    while IFS= read -r skill; do
        if [ -n "$skill" ]; then
            CMD="$CMD --skill \"$CONFIG_DIR/$skill\""
        fi
    done < <(jq -r '.skills[]' "$CONFIG_DIR/config.json" 2>/dev/null)

    # Load prompts (as extra system prompt)
    while IFS= read -r prompt; do
        if [ -n "$prompt" ]; then
            CMD="$CMD --append-system-prompt \"$CONFIG_DIR/$prompt\""
        fi
    done < <(jq -r '.prompts[]' "$CONFIG_DIR/config.json" 2>/dev/null)
fi

# Run the command
eval $CMD