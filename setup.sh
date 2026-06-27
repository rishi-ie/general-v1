#!/bin/bash
set -euo pipefail

# general v1 — interactive setup
# Run this once to install dependencies and configure your API key.
# Usage: ./setup.sh
#
# This script is idempotent — safe to re-run.
#
# What it does:
#   1. Installs dependencies (clones Pi Agent, npm install)
#   2. Creates symlinks, state directories, and agent identity
#   3. Prompts you for an API key interactively
#   4. Verifies the setup works

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Colours ──────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
RESET='\033[0m'

info()    { echo -e "${GREEN}[setup]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[setup]${RESET} $*"; }
error()   { echo -e "${RED}[setup]${RESET} $*" >&2; }
bold()    { echo -e "${BOLD}$*${RESET}"; }
section() { echo ""; echo -e "${BOLD}── $* ──────────────────────────────────────${RESET}"; }

# ── Helpers ──────────────────────────────────────────────────────────────────
requires_tty() {
    if [[ ! -t 0 || ! -t 1 ]]; then
        error "setup.sh requires an interactive terminal."
        error "Run it directly: ./setup.sh"
        exit 1
    fi
}

check_cmd() {
    if ! command -v "$1" &>/dev/null; then
        error "Required command not found: $1"
        error "Install it and re-run setup."
        exit 1
    fi
}

prompt_yesno() {
    local prompt="$1" default="${2:-}"
    local reply
    while true; do
        if [[ -n "$default" ]]; then
            read -r -p "$(echo -e "${CYAN}[$prompt${RESET}${BOLD} [${default}]${RESET}: ")" reply
            reply="${reply:-$default}"
        else
            read -r -p "$(echo -e "${CYAN}[$prompt]${RESET}: ")" reply
        fi
        case "$reply" in
            y|Y) return 0 ;;
            n|N) return 1 ;;
            *) [[ -z "$reply" ]] && continue ;;
        esac
    done
}

prompt_choice() {
    local prompt="$1" var="$2" default="${3:-}"
    local reply
    while true; do
        if [[ -n "$default" ]]; then
            read -r -p "$(echo -e "${CYAN}$prompt${RESET}${BOLD} [${default}]${RESET}: ")" reply
            reply="${reply:-$default}"
        else
            read -r -p "$(echo -e "${CYAN}$prompt${RESET}: ")" reply
        fi
        if [[ -z "$reply" ]]; then
            continue
        fi
        return 0
    done
}

mask_key() {
    local key="$1"
    if [[ ${#key} -le 8 ]]; then
        echo "****"
    else
        echo "${key:0:6}...${key: -4}"
    fi
}

strip_key() {
    # Accept raw key, or pasted "export FOO_API_KEY=sk-..." or "FOO_API_KEY='sk-...'" etc.
    echo "$1" | sed \
        -e 's/^[[:space:]]*export[[:space:]]*//' \
        -e 's/^[A-Z_]\+_API_KEY[[:space:]]*=[[:space:]]*//' \
        -e 's/^["'\'']//' \
        -e 's/["'\'']$//' \
        -e 's/^[[:space:]]*//' \
        -e 's/[[:space:]]*$//'
}

# ── Pre-flight checks ─────────────────────────────────────────────────────────
requires_tty

section "Pre-flight checks"
check_cmd node
check_cmd git
check_cmd jq

NODE_MAJOR=$(node -v | tr -d 'v' | cut -d. -f1)
NODE_MINOR=$(node -v | tr -d 'v' | cut -d. -f2)
if [[ "$NODE_MAJOR" -lt 22 ]] || [[ "$NODE_MAJOR" -eq 22 && "$NODE_MINOR" -lt 19 ]]; then
    error "Node 22.19+ required. Found: $(node -v)"
    error "Install: https://nodejs.org"
    exit 1
fi
info "Node: $(node -v) ✓"

# ── Provider list ──────────────────────────────────────────────────────────────
declare -A PROVIDERS=(
    [1]="minimax"
    [2]="anthropic"
    [3]="google"
    [4]="openai"
    [5]="deepseek"
    [6]="groq"
    [7]="mistral"
    [8]="openrouter"
    [9]="together"
    [10]="fireworks"
    [11]="nvidia"
    [12]="huggingface"
)

declare -A PROVIDER_NAMES=(
    [minimax]="MiniMax"
    [anthropic]="Anthropic (Claude)"
    [google]="Google Gemini"
    [openai]="OpenAI"
    [deepseek]="DeepSeek"
    [groq]="Groq"
    [mistral]="Mistral"
    [openrouter]="OpenRouter"
    [together]="Together AI"
    [fireworks]="Fireworks AI"
    [nvidia]="NVIDIA NIM"
    [huggingface]="Hugging Face"
)

declare -A PROVIDER_VARS=(
    [minimax]="MINIMAX_API_KEY"
    [anthropic]="ANTHROPIC_API_KEY"
    [google]="GEMINI_API_KEY"
    [openai]="OPENAI_API_KEY"
    [deepseek]="DEEPSEEK_API_KEY"
    [groq]="GROQ_API_KEY"
    [mistral]="MISTRAL_API_KEY"
    [openrouter]="OPENROUTER_API_KEY"
    [together]="TOGETHER_API_KEY"
    [fireworks]="FIREWORKS_API_KEY"
    [nvidia]="NVIDIA_API_KEY"
    [huggingface]="HF_TOKEN"
)

# ── Welcome ───────────────────────────────────────────────────────────────────
section "general-v1 — setup"
echo ""
echo -e "  ${BOLD}general-v1${RESET} is a portable CLI agent built on Pi Agent."
echo -e "  This script installs dependencies and configures your API key."
echo ""
echo "  Supported providers: MiniMax, Anthropic, Google, OpenAI, DeepSeek,"
echo "  Groq, Mistral, OpenRouter, Together AI, Fireworks, NVIDIA, Hugging Face."
echo ""
echo "  You can skip this step and run ${BOLD}./meta-agent/run.sh --offline${RESET}"
echo "  to try the agent without an API key."
echo ""

# ── Already set up? ───────────────────────────────────────────────────────────
if [[ -f "$SCRIPT_DIR/meta-agent/.setup-complete" ]]; then
    echo ""
    warn "general-v1 has already been set up."
    if prompt_yesno "Re-run setup? [y/N]" "n"; then
        info "Re-running setup..."
    else
        info "No changes made. Run ./meta-agent/run.sh to start."
        exit 0
    fi
fi

# ── Existing auth.json ────────────────────────────────────────────────────────
AUTH_JSON="$SCRIPT_DIR/meta-agent/meta-agent-config/auth.json"
AUTH_EXAMPLE="$SCRIPT_DIR/meta-agent/meta-agent-config/auth.json.example"

declare -A EXISTING_KEYS=()
EXISTING_COUNT=0

if [[ -f "$AUTH_JSON" ]]; then
    section "Existing configuration detected"
    echo ""
    for prov in "${!PROVIDER_VARS[@]}"; do
        local var="${PROVIDER_VARS[$prov]}"
        local key
        key=$(jq -r ".$prov.key // \"\" | select(. != null and . != \"\")" "$AUTH_JSON" 2>/dev/null || echo "")
        if [[ -n "$key" && "$key" != "null" ]]; then
            EXISTING_KEYS[$prov]="$key"
            ((EXISTING_COUNT++))
            echo -e "  ${GREEN}${PROVIDER_NAMES[$prov]}${RESET}  ${mask_key "$key"}"
        fi
    done

    if [[ $EXISTING_COUNT -gt 0 ]]; then
        echo ""
        info "$EXISTING_COUNT provider(s) already configured."
        if prompt_yesno "Reconfigure? This will overwrite existing keys [y/N]" "n"; then
            info "Proceeding with reconfiguration..."
        else
            info "Keeping existing configuration."
            echo ""
            info "Run ${BOLD}./meta-agent/run.sh${RESET} to start."
            exit 0
        fi
    fi
fi

# ── Install dependencies ───────────────────────────────────────────────────────
section "Installing dependencies"

META_SETUP="$SCRIPT_DIR/meta-agent/setup.sh"
if [[ -f "$META_SETUP" ]]; then
    info "Running meta-agent/setup.sh..."
    "$META_SETUP" 2>&1 | sed 's/^/[setup] /'
else
    # Fallback: clone Pi and install manually
    warn "meta-agent/setup.sh not found — installing manually."

    PI_DIR="$SCRIPT_DIR/meta-agent/pi"
    if [[ ! -d "$PI_DIR" ]]; then
        info "Cloning Pi Agent..."
        git clone --depth 1 https://github.com/earendil-works/pi.git "$PI_DIR"
    fi

    if [[ ! -d "$PI_DIR/node_modules" ]]; then
        info "Installing Pi Agent dependencies..."
        cd "$PI_DIR" && npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts
        cd "$SCRIPT_DIR"
    fi

    info "Creating local directories..."
    mkdir -p "$SCRIPT_DIR/meta-agent/.pi/agent/sessions"
    mkdir -p "$SCRIPT_DIR/meta-agent/.pi/agent/bin"
    mkdir -p "$SCRIPT_DIR/meta-agent/.pi/agent/prompts"
    mkdir -p "$SCRIPT_DIR/.general-v1/sac"
    mkdir -p "$SCRIPT_DIR/.general-v1/vectors"
    mkdir -p "$SCRIPT_DIR/.general-v1/mission-control"
    mkdir -p "$SCRIPT_DIR/.general-v1/audit"

    info "Creating v1 symlinks..."
    CONFIG_DIR="$SCRIPT_DIR/meta-agent/meta-agent-config"
    mkdir -p "$CONFIG_DIR/v1"
    for mod in browser communication docs identity mission-control permission planning sub-agent sub-agent-context superhive integrations lancedb; do
        if [[ ! -e "$CONFIG_DIR/v1/$mod" ]]; then
            ln -sf "$SCRIPT_DIR/v1/$mod" "$CONFIG_DIR/v1/$mod"
        fi
    done

    # Generate identity if missing
    IDENTITY_FILE="$SCRIPT_DIR/.general-v1/.identity"
    if [[ ! -f "$IDENTITY_FILE" ]]; then
        NEW_ULID="$(node -e "console.log(require('ulid').ulid())" 2>/dev/null || echo "$(printf '%012x' "$(date +%s)" | tr 'a-f' 'A-F')-0000-0000-0000-000000000000")"
        mkdir -p "$SCRIPT_DIR/.general-v1"
        printf '%s' "$NEW_ULID" > "$IDENTITY_FILE"
        info "Identity: $NEW_ULID"
    fi
fi

touch "$SCRIPT_DIR/meta-agent/.setup-complete"
info "Dependencies installed ✓"

# ── Provider selection ────────────────────────────────────────────────────────
section "Configure API key"

CONFIGURED_KEYS=()
ADD_MORE=true

while $ADD_MORE; do
    echo ""
    echo "Select a provider to configure (or skip):"
    echo ""
    for num in "${!PROVIDERS[@]}"; do
        local prov="${PROVIDERS[$num]}"
        local name="${PROVIDER_NAMES[$prov]}"
        local var="${PROVIDER_VARS[$prov]}"
        local configured=""
        if [[ -n "${EXISTING_KEYS[$prov]:-}" ]]; then
            configured=" (${mask_key "${EXISTING_KEYS[$prov]}"})"
        elif [[ -n "${!var:-}" ]]; then
            configured=" (${mask_key "${!var}"} in env)"
        fi
        echo -e "  ${BOLD}$num${RESET}. $name$configured"
    done
    echo ""
    echo -e "  ${BOLD}s${RESET}. Skip — configure later (run offline)"
    echo -e "  ${BOLD}e${RESET}. Use existing environment variable"
    echo ""

    local choice=""
    prompt_choice "Enter number [s]" choice "s"

    case "$choice" in
        s|S)
            info "Skipping API key configuration."
            info "Run ${BOLD}./meta-agent/run.sh --offline${RESET} to try the agent without an API key."
            echo ""
            info "To configure a key later, run ${BOLD}./setup.sh${RESET} again."
            exit 0
            ;;

        e|E)
            info "Scanning for API keys in environment..."
            local found=false
            for prov in minimax anthropic google openai deepseek groq mistral openrouter together fireworks nvidia huggingface; do
                local var="${PROVIDER_VARS[$prov]}"
                if [[ -n "${!var:-}" ]]; then
                    CONFIGURED_KEYS+=("$prov:${!var}")
                    info "Found ${PROVIDER_NAMES[$prov]} key in \$$var ✓"
                    found=true
                fi
            done
            if $found; then
                break
            else
                warn "No API keys found in environment variables."
                warn "Set one first: export MINIMAX_API_KEY=..."
                echo ""
                if prompt_yesno "Configure interactively instead? [Y/n]" "Y"; then
                    continue
                else
                    exit 0
                fi
            fi
            ;;

        *)
            local num
            num=$(echo "$choice" | tr -cd '0-9' | head -c 2)
            if [[ -z "${PROVIDERS[$num]:-}" ]]; then
                warn "Invalid selection: $choice"
                continue
            fi
            local prov="${PROVIDERS[$num]}"
            local var="${PROVIDER_VARS[$prov]}"
            local name="${PROVIDER_NAMES[$prov]}"

            echo ""
            echo -e "  ${BOLD}$name${RESET}"
            echo ""

            # Check env var first
            if [[ -n "${!var:-}" ]]; then
                if prompt_yesno "Use key from \$$var? [Y/n]" "Y"; then
                    CONFIGURED_KEYS+=("$prov:${!var}")
                else
                    CONFIGURED_KEYS+=("$prov:")
                fi
            else
                CONFIGURED_KEYS+=("$prov:")
            fi

            # If empty (not from env), prompt interactively
            local entry="${CONFIGURED_KEYS[-1]}"
            local key="${entry#*:}"
            if [[ -z "$key" ]]; then
                echo -e "  Paste or type your ${BOLD}$name${RESET} API key."
                echo -e "  (Hidden — press Enter when done)"
                echo ""
                local raw_key=""
                read -r -s -p "  API key: " raw_key
                echo ""
                key=$(strip_key "$raw_key")
                if [[ -z "$key" ]]; then
                    error "Key cannot be empty."
                    unset 'CONFIGURED_KEYS[${#CONFIGURED_KEYS[@]}-1]'
                    continue
                fi
                CONFIGURED_KEYS[-1]="$prov:$key"
            fi

            info "Key saved (${mask_key "$key"}) ✓"
            echo ""

            if prompt_yesno "Add another provider? [y/N]" "n"; then
                ADD_MORE=true
            else
                ADD_MORE=false
            fi
            ;;
    esac
done

# ── Write auth.json ────────────────────────────────────────────────────────────
section "Writing configuration"

if [[ ${#CONFIGURED_KEYS[@]} -eq 0 ]]; then
    warn "No keys configured."
else
    # Build jq expression to set keys
    local jq_expr='del(._instructions, ._providers, ._example, ._actual_fill_below)'
    for entry in "${CONFIGURED_KEYS[@]}"; do
        local prov="${entry%%:*}"
        local key="${entry#*:}"
        jq_expr="$jq_expr | .$prov.key = \"$key\""
    done

    if [[ -f "$AUTH_EXAMPLE" ]]; then
        jq "$jq_expr" "$AUTH_EXAMPLE" > "$AUTH_JSON"
        chmod 600 "$AUTH_JSON"
        info "Written: $AUTH_JSON"
    else
        # Build from scratch
        local json="{}"
        for entry in "${CONFIGURED_KEYS[@]}"; do
            local prov="${entry%%:*}"
            local key="${entry#*:}"
            json=$(echo "$json" | jq ".$prov = {\"type\": \"api_key\", \"key\": \"$key\"}")
        done
        echo "$json" > "$AUTH_JSON"
        chmod 600 "$AUTH_JSON"
        info "Written: $AUTH_JSON"
    fi
fi

# ── Print env var lines ────────────────────────────────────────────────────────
echo ""
section "Environment variables"
echo ""
echo "  Add these to your shell config (~/.zshrc or ~/.bashrc)"
echo "  to persist the keys across sessions:"
echo ""
for entry in "${CONFIGURED_KEYS[@]}"; do
    local prov="${entry%%:*}"
    local key="${entry#*:}"
    local var="${PROVIDER_VARS[$prov]}"
    echo -e "  ${GREEN}export $var=\"$key\"${RESET}"
done
echo ""

# ── Verify ────────────────────────────────────────────────────────────────────
section "Verifying setup"

if [[ -f "$AUTH_JSON" ]]; then
    if [[ -x "$SCRIPT_DIR/meta-agent/run.sh" ]]; then
        info "Running ./meta-agent/run.sh --check..."
        echo ""
        if "$SCRIPT_DIR/meta-agent/run.sh" --check 2>&1; then
            info "Setup verified ✓"
        else
            warn "Verification returned non-zero. Check errors above."
        fi
    fi
fi

# ── Done ──────────────────────────────────────────────────────────────────────
section "Setup complete"
echo ""
echo "  Run the agent:"
echo ""
echo -e "    ${BOLD}./meta-agent/run.sh${RESET}                  # Interactive mode"
echo -e "    ${BOLD}./meta-agent/run.sh -p \"hello\"${RESET}     # One-shot"
echo -e "    ${BOLD}./meta-agent/run.sh --offline${RESET}        # Offline (no API key)"
echo ""
echo "  To add or change a provider, run:"
echo -e "    ${BOLD}./setup.sh${RESET}"
echo ""
