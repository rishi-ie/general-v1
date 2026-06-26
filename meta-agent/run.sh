#!/bin/bash
set -euo pipefail

# general v1 — CLI agent launcher
# Usage: ./run.sh [flags]
#   --offline       Run without LLM (stub responses, all commands work)
#   --check         Validate config and extensions, exit 0/1
#   --provider X    Override auto-detected provider
#   --model Y      Override auto-detected model
#   --cwd DIR      Set working directory (default: current dir)
#   --no-superhive Skip SuperHive WS client connection
#   -p "prompt"    One-shot prompt (non-interactive)
#   -n "name"      Session name

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR/meta-agent-config"
PI_DIR="$SCRIPT_DIR/pi"
LOCAL_PI_DIR="$SCRIPT_DIR/.pi"

# ── Node version check ──────────────────────────────────────────────────────
NODE_MAJOR=$(node -v | tr -d 'v' | cut -d. -f1)
if [[ "$NODE_MAJOR" -lt 22 ]]; then
    echo "[general] Error: Node 22.19+ required. Found: $(node -v)" >&2
    echo "[general] Install: https://nodejs.org or 'nvm install 22'" >&2
    exit 1
fi

# ── Flags ───────────────────────────────────────────────────────────────────
OFFLINE=false
CHECK_ONLY=false
PROVIDER_FLAG=""
MODEL_FLAG=""
CWD_FLAG=""
NO_SUPERHIVE=false
PRINT_PROMPT=""
SESSION_NAME=""
REMAINING_ARGS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --offline)      OFFLINE=true; shift ;;
        --check)        CHECK_ONLY=true; shift ;;
        --provider)     PROVIDER_FLAG="$2"; shift 2 ;;
        --model)        MODEL_FLAG="$2"; shift 2 ;;
        --cwd)          CWD_FLAG="$2"; shift 2 ;;
        --no-superhive) NO_SUPERHIVE=true; shift ;;
        -p|--print)     PRINT_PROMPT="$2"; shift 2 ;;
        -n|--name)      SESSION_NAME="$2"; shift 2 ;;
        -h|--help)
            echo "general v1 — CLI agent"
            echo "Usage: ./run.sh [flags]"
            echo "  --offline       Run without LLM (stub responses, all commands work)"
            echo "  --check         Validate config and extensions, exit 0/1"
            echo "  --provider X    Override auto-detected provider"
            echo "  --model Y       Override auto-detected model"
            echo "  --cwd DIR       Set working directory"
            echo "  --no-superhive  Skip SuperHive WS client connection"
            echo "  -p 'prompt'     One-shot prompt (non-interactive)"
            echo "  -n 'name'       Session name"
            echo ""
            echo "Environment variables:"
            echo "  MINIMAX_API_KEY, ANTHROPIC_API_KEY, ..."
            echo "  SUPERHIVE_WS_URL  (default: ws://127.0.0.1:7711)"
            echo "  OFFLINE=1          (equivalent to --offline)"
            exit 0
            ;;
        --) shift; REMAINING_ARGS+=("$@"); break ;;
        -*) echo "[general] Unknown flag: $1" >&2; exit 1 ;;
        *)  REMAINING_ARGS+=("$1"); shift ;;
    esac
done
set -- "${REMAINING_ARGS[@]+"${REMAINING_ARGS[@]}"}"

# ── Setup (first run) ───────────────────────────────────────────────────────
if [[ ! -f "$SCRIPT_DIR/.setup-complete" ]]; then
    echo "[general] Running first-time setup..."
    "$SCRIPT_DIR/setup.sh" 2>&1 | sed 's/^/[setup] /'
    touch "$SCRIPT_DIR/.setup-complete"
    echo "[general] Setup complete."
fi

# ── Clone Pi if missing ──────────────────────────────────────────────────────
if [[ ! -d "$PI_DIR" ]]; then
    echo "[general] Cloning Pi Agent..."
    git clone --depth 1 https://github.com/earendil-works/pi.git "$PI_DIR"
fi

# ── Install Pi dependencies ───────────────────────────────────────────────────
if [[ ! -d "$PI_DIR/node_modules" ]]; then
    echo "[general] Installing Pi Agent dependencies..."
    cd "$PI_DIR" && npm ci --ignore-scripts --silent 2>/dev/null || npm install --ignore-scripts --silent 2>/dev/null
    cd "$SCRIPT_DIR"
fi

# ── Verify Pi test script exists ─────────────────────────────────────────────
if [[ ! -f "$PI_DIR/pi-test.sh" ]]; then
    echo "[general] Error: pi-test.sh not found at $PI_DIR/pi-test.sh" >&2
    exit 1
fi

# ── Bootstrap auth.json ──────────────────────────────────────────────────────
if [[ ! -f "$CONFIG_DIR/auth.json" ]]; then
    if [[ -f "$CONFIG_DIR/auth.json.example" ]]; then
        cp "$CONFIG_DIR/auth.json.example" "$CONFIG_DIR/auth.json"
        echo ""
        echo "============================================"
        echo "  general — first-run setup"
        echo "============================================"
        echo ""
        echo "  auth.json created from example."
        echo "  Edit it and add your API key."
        echo ""
        echo "  Supported providers:"
        echo "    minimax, anthropic, google, openai,"
        echo "    deepseek, groq, mistral, openrouter, together"
        echo ""
        echo "  Or set env var: MINIMAX_API_KEY=..."
        echo "============================================"
        echo ""
    fi
fi

# ── Create local .pi directory ───────────────────────────────────────────────
mkdir -p "$LOCAL_PI_DIR/agent/sessions"
mkdir -p "$LOCAL_PI_DIR/agent/bin"
mkdir -p "$LOCAL_PI_DIR/agent/prompts"

# ── Provider auto-detect ─────────────────────────────────────────────────────
DETECTED_PROVIDER=""
DETECTED_MODEL=""

if [[ "$OFFLINE" == "true" ]]; then
    echo "[general] Mode: offline (no LLM)"
elif [[ -n "$PROVIDER_FLAG" ]]; then
    DETECTED_PROVIDER="$PROVIDER_FLAG"
    if [[ -n "$MODEL_FLAG" ]]; then
        DETECTED_MODEL="$MODEL_FLAG"
    fi
elif [[ -f "$CONFIG_DIR/auth.json" ]]; then
    # Ordered provider priority: minimax first, then others
    for provider in minimax anthropic google openai deepseek groq mistral openrouter together; do
        case "$provider" in
            minimax)    KEY_VAR="MINIMAX_API_KEY" ;;
            anthropic)  KEY_VAR="ANTHROPIC_API_KEY" ;;
            google)     KEY_VAR="GEMINI_API_KEY" ;;
            openai)    KEY_VAR="OPENAI_API_KEY" ;;
            deepseek)  KEY_VAR="DEEPSEEK_API_KEY" ;;
            groq)      KEY_VAR="GROQ_API_KEY" ;;
            mistral)   KEY_VAR="MISTRAL_API_KEY" ;;
            openrouter) KEY_VAR="OPENROUTER_API_KEY" ;;
            together)  KEY_VAR="TOGETHER_API_KEY" ;;
        esac
        # Check env var first
        KEY="${!KEY_VAR:-}"
        # Fall back to auth.json
        if [[ -z "$KEY" ]] && [[ -f "$CONFIG_DIR/auth.json" ]]; then
            KEY=$(jq -r ".$provider.key // \"\" " "$CONFIG_DIR/auth.json" 2>/dev/null)
        fi
        if [[ -n "$KEY" ]] && [[ "$KEY" != "null" ]] && [[ "$KEY" != "" ]]; then
            DETECTED_PROVIDER="$provider"
            break
        fi
    done

    # Set model per provider
    if [[ -z "$MODEL_FLAG" ]]; then
        case "$DETECTED_PROVIDER" in
            minimax)    DETECTED_MODEL="MiniMax-M3" ;;
            anthropic)  DETECTED_MODEL="claude-sonnet-4-5" ;;
            google)     DETECTED_MODEL="gemini-2.5-flash" ;;
            openai)    DETECTED_MODEL="gpt-4o" ;;
            deepseek)  DETECTED_MODEL="deepseek-chat" ;;
            groq)      DETECTED_MODEL="llama-3.3-70b-versatile" ;;
            mistral)   DETECTED_MODEL="mistral-large-latest" ;;
            openrouter) DETECTED_MODEL="anthropic/claude-3.5-sonnet" ;;
            together)  DETECTED_MODEL="meta-llama/Llama-3.3-70B-Instruct" ;;
            *)          DETECTED_PROVIDER=""; DETECTED_MODEL="" ;;
        esac
    else
        DETECTED_MODEL="$MODEL_FLAG"
    fi
fi

# ── Build settings.json ──────────────────────────────────────────────────────
SETTINGS_FILE="$LOCAL_PI_DIR/agent/settings.json"
mkdir -p "$LOCAL_PI_DIR/agent"
if [[ -n "$DETECTED_PROVIDER" ]]; then
    cat > "$SETTINGS_FILE" << EOF
{
  "lastChangelogVersion": "0.78.0",
  "defaultProvider": "$DETECTED_PROVIDER",
  "defaultModel": "$DETECTED_MODEL",
  "defaultThinkingLevel": "medium"
}
EOF
    if [[ "$DETECTED_PROVIDER" == "minimax" ]]; then
        export MINIMAX_API_KEY="${MINIMAX_API_KEY:-}"
    fi
elif [[ -f "$CONFIG_DIR/settings.json" ]]; then
    cp "$CONFIG_DIR/settings.json" "$SETTINGS_FILE"
fi

# Copy auth.json if it exists
if [[ -f "$CONFIG_DIR/auth.json" ]]; then
    cp "$CONFIG_DIR/auth.json" "$LOCAL_PI_DIR/agent/auth.json"
fi

# ── Environment ───────────────────────────────────────────────────────────────
export PI_CODING_AGENT_DIR="$LOCAL_PI_DIR/agent"
export PI_CODING_AGENT_SESSION_DIR="$LOCAL_PI_DIR/agent/sessions"
export PI_SKIP_VERSION_CHECK=1
export PI_OFFLINE="${PI_OFFLINE:-}"

if [[ "$OFFLINE" == "true" ]]; then
    export PI_OFFLINE=1
    export PI_SKIP_VERSION_CHECK=1
fi

if [[ -n "$CWD_FLAG" ]]; then
    cd "$CWD_FLAG" || { echo "[general] Error: directory not found: $CWD_FLAG" >&2; exit 1; }
fi

# SuperHive WS URL
SUPERHIVE_WS_URL="${SUPERHIVE_WS_URL:-ws://127.0.0.1:7711}"
if [[ "$NO_SUPERHIVE" == "true" ]]; then
    SUPERHIVE_WS_URL=""
fi

# ── CHECK mode ───────────────────────────────────────────────────────────────
if [[ "$CHECK_ONLY" == "true" ]]; then
    ERRORS=0

    if [[ ! -d "$PI_DIR/node_modules" ]]; then
        echo "[check] ERROR: Pi node_modules not installed" >&2
        ERRORS=$((ERRORS + 1))
    fi

    if [[ ! -f "$CONFIG_DIR/config.json" ]]; then
        echo "[check] ERROR: config.json not found" >&2
        ERRORS=$((ERRORS + 1))
    fi

    if command -v jq >/dev/null 2>&1; then
        EXTENSIONS=$(jq -r '.extensions[]' "$CONFIG_DIR/config.json" 2>/dev/null || echo "")
        for ext in $EXTENSIONS; do
            if [[ -n "$ext" ]]; then
                EXT_PATH="$CONFIG_DIR/$ext"
                if [[ ! -e "$EXT_PATH" ]]; then
                    echo "[check] ERROR: extension not found: $EXT_PATH" >&2
                    ERRORS=$((ERRORS + 1))
                fi
            fi
        done
    fi

    if [[ $ERRORS -eq 0 ]]; then
        echo "[check] OK — general v1 config valid"
        echo "[check]   provider: ${DETECTED_PROVIDER:-none}"
        echo "[check]   model: ${DETECTED_MODEL:-none}"
        echo "[check]   offline: $OFFLINE"
        echo "[check]   superhive: ${SUPERHIVE_WS_URL:-disabled}"
        exit 0
    else
        echo "[check] FAILED — $ERRORS error(s)" >&2
        exit 1
    fi
fi

# ── Build pi command (bash array — no eval) ─────────────────────────────────
PI_CMD=()
PI_CMD+=("$PI_DIR/pi-test.sh")

# Model flags
if [[ -n "$DETECTED_PROVIDER" ]]; then
    PI_CMD+=(--provider "$DETECTED_PROVIDER")
fi
if [[ -n "$DETECTED_MODEL" ]]; then
    PI_CMD+=(--model "$DETECTED_MODEL")
fi

# Session name
if [[ -n "$SESSION_NAME" ]]; then
    PI_CMD+=(--name "$SESSION_NAME")
elif [[ -z "$PRINT_PROMPT" ]]; then
    PI_CMD+=(--name "general")
fi

# Skills
if [[ -f "$CONFIG_DIR/config.json" ]] && command -v jq >/dev/null 2>&1; then
    while IFS= read -r skill; do
        [[ -z "$skill" ]] && continue
        PI_CMD+=(--skill "$CONFIG_DIR/$skill")
    done < <(jq -r '.skills[]' "$CONFIG_DIR/config.json" 2>/dev/null)

    # Prompts
    while IFS= read -r prompt; do
        [[ -z "$prompt" ]] && continue
        PI_CMD+=(--append-system-prompt "$CONFIG_DIR/$prompt")
    done < <(jq -r '.prompts[]' "$CONFIG_DIR/config.json" 2>/dev/null)

    # Extensions (v1 modules + integrations)
    while IFS= read -r ext; do
        [[ -z "$ext" ]] && continue
        PI_CMD+=(-e "$CONFIG_DIR/$ext")
    done < <(jq -r '.extensions[]' "$CONFIG_DIR/config.json" 2>/dev/null)
fi

# Context files (disable AGENTS.md discovery)
PI_CMD+=(--no-context-files)

# Print mode
if [[ -n "$PRINT_PROMPT" ]]; then
    PI_CMD+=(-p "$PRINT_PROMPT")
fi

# Forward remaining positional args
PI_CMD+=("${REMAINING_ARGS[@]+"${REMAINING_ARGS[@]}"}")

# ── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  general v1.0.0"
echo "============================================"
echo "  provider : ${DETECTED_PROVIDER:-none}"
echo "  model    : ${DETECTED_MODEL:-none}"
echo "  offline  : $OFFLINE"
echo "  superhive : ${SUPERHIVE_WS_URL:-disabled}"
echo "  cwd      : $(pwd)"
echo "============================================"
echo ""

# ── Launch ───────────────────────────────────────────────────────────────────
cleanup() {
    # Kill child process group on SIGINT/SIGTERM
    kill -TERM "$$" 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM

# Set env for extensions (SUPERHIVE_WS_URL if not disabled)
if [[ -n "$SUPERHIVE_WS_URL" ]]; then
    export SUPERHIVE_WS_URL
fi

# If offline and no provider, run with --no-env (clears keys) and a note
if [[ "$OFFLINE" == "true" ]] && [[ -z "$DETECTED_PROVIDER" ]]; then
    exec "${PI_CMD[@]}" --no-env
else
    exec "${PI_CMD[@]}"
fi
