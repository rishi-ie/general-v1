# Communication Module — Integration Guide

**Version**: 1.0.0
**Purpose**: How other General V1 modules integrate with the communication module.

---

## 1. Integration Overview

The communication module (`v1/communication/`) is the **SuperHive bridge**. Other modules integrate with it to:

1. **Expose settings** for SuperHive to control
2. **Request permission** for sensitive actions
3. **Send inter-agent messages**
4. **Report state** to SuperHive
5. **Receive settings updates** from SuperHive
6. **Receive commands** from SuperHive

---

## 2. Integration Patterns

### 2.1 Direct Import (Recommended)

The cleanest integration is to import the communication module's exported functions:

```typescript
import {
  requestPermission,
  sendInterAgentMessage,
  grantAuthority,
  revokeAuthority,
  updatePresence,
  updateState,
  setOnInterAgentMessage,
  setOnAuthorityRevoked,
  setOnPresenceSnapshot,
  setOnCommand,
} from './v1/communication/extensions/communication/index.ts';
```

### 2.2 Event Subscription Pattern

For callbacks from communication to other modules:

```typescript
// At module startup, register handlers
setOnInterAgentMessage((msg) => {
  if (msg.kind === 'text' && msg.payload.type === 'task_request') {
    handleTaskRequest(msg);
  }
});

setOnCommand((cmd, args) => {
  if (cmd === 'pause') {
    pauseWork();
  } else if (cmd === 'resume') {
    resumeWork();
  }
});
```

### 2.3 Settings Callback Pattern

When SuperHive pushes settings, the communication module applies them. Other modules can register to be notified:

```typescript
// In communication/index.ts, export a settings change emitter
export const onSettingsChanged = new EventEmitter<SettingsPatch[]>();

// After applying a patch, emit
onSettingsChanged.emit(patch);

// In other modules
onSettingsChanged.on((patch) => {
  for (const op of patch) {
    if (op.path.startsWith('/mem0/')) {
      applyMem0Settings(op);
    } else if (op.path.startsWith('/sub-agent/')) {
      applySubAgentSettings(op);
    }
  }
});
```

---

## 3. Module-by-Module Integration

### 3.1 permission/ Module

**Role**: Local permission enforcement (fallback)

**Integration with communication**:

The `permission/` module should route **sensitive** permission requests through SuperHive:

```typescript
// permission/extension.ts

import { requestPermission } from '../../communication/extensions/communication/index.ts';

async function checkPermission(tool: string, args: unknown): Promise<'allow' | 'deny' | 'ask'> {
  const localResult = checkLocalRules(tool, args);
  if (localResult !== 'ask') {
    return localResult;
  }

  // Ask SuperHive
  const decision = await requestPermission(
    tool,
    args,
    `Permission request for ${tool}`,
    getSeverity(tool)
  );

  return decision.decision;
}
```

**Settings controlled by SuperHive**:
```typescript
interface PermissionSettings {
  defaultPolicy: 'allow' | 'deny' | 'ask';
  timeoutMs: number;
  requireSuperhiveApproval: string[];  // tools that MUST go through SuperHive
}
```

**How SuperHive overrides local rules**:
1. User configures `requireSuperhiveApproval` in SuperHive UI
2. Setting is pushed via `SETTINGS_UPDATE`
3. `permission/` module reads the updated list
4. Any tool in the list is routed through `requestPermission()` instead of local rules

**Manifest entries** (hint for SuperHive UI):
```json
{
  "permissions": ["file_delete", "file_write", "command_execute", "sub_agent_spawn", "network_request"]
}
```

---

### 3.2 sub-agent/ Module

**Role**: Spawn and manage sub-agents

**Integration with communication**:

```typescript
// sub-agent/extension.ts

import {
  updateState,
  sendInterAgentMessage,
} from '../../communication/extensions/communication/index.ts';

function spawnSubAgent(type: string, prompt: string): string {
  const id = generateSubAgentId();

  // Spawn the sub-agent
  const subAgent = new SubAgent(type, prompt, {
    onStateChange: (state) => {
      // Report sub-agent state to SuperHive
      updateState({
        subAgents: getActiveSubAgents().map(sa => ({
          id: sa.id,
          type: sa.type,
          status: sa.status,
        }))
      });
    },
    onComplete: (result) => {
      // Optionally notify other agents
      sendInterAgentMessage(undefined, true, undefined, 'event', {
        type: 'sub_agent_complete',
        agentId: id,
        result,
      });
    },
  });

  return id;
}
```

**Settings controlled by SuperHive**:
```typescript
interface SubAgentSettings {
  maxConcurrent: number;       // Max parallel sub-agents
  defaultMaxTurns: number;     // Default turn limit
  defaultModel: string;        // Default model
  allowedTypes: string[];       // Which sub-agent types are allowed
}
```

**Reported to SuperHive**:
```typescript
// In AGENT_STATE
{
  subAgents: [
    { id: "sub-1", type: "debugger", status: "running" },
    { id: "sub-2", type: "writer", status: "paused" },
  ]
}
```

**Commands from SuperHive**:
```typescript
setOnCommand((cmd, args) => {
  if (cmd === 'pause') {
    pauseAllSubAgents();
  } else if (cmd === 'resume') {
    resumeAllSubAgents();
  } else if (cmd === 'reload') {
    // Reload sub-agent configuration
    loadSubAgentConfig();
  }
});
```

---

### 3.3 mem0/ Module

**Role**: Persistent cross-session memory

**Integration with communication**:

```typescript
// mem0/extension.ts

import { sendInterAgentMessage } from '../../communication/extensions/communication/index.ts';

async function storeMemory(content: string, metadata: Record<string, unknown>): Promise<void> {
  // Store locally
  await mem0Store.add({ content, metadata });

  // Optionally broadcast to other agents
  sendInterAgentMessage(undefined, true, undefined, 'event', {
    type: 'memory_stored',
    preview: content.slice(0, 100),
    agentId: getMyAgentId(),
  });
}
```

**Settings controlled by SuperHive**:
```typescript
interface Mem0Settings {
  autoRecall: boolean;         // Automatically recall relevant memories
  retentionDays: number;       // How long to keep memories
  maxMemories: number;         // Maximum memories to store
  recallLimit: number;         // Max memories to recall per query
}
```

**SuperHive can browse/edit memories**:
- SuperHive UI can call `mem0Store.search()` to browse memories
- User can delete/edit memories from SuperHive UI
- These changes sync back to the agent via `SETTINGS_UPDATE`

---

### 3.4 planning/ Module

**Role**: Manus-style file-based task planning

**Integration with communication**:

```typescript
// planning/extension.ts

import { updateState } from '../../communication/extensions/communication/index.ts';

function updatePlanStatus(phase: string, task: string): void {
  // Write to plan files
  writePlanFiles(phase, task);

  // Stream to SuperHive
  updateState({
    currentTask: task,
    phase: phase,
  });
}
```

**Settings controlled by SuperHive**:
```typescript
interface PlanningSettings {
  planFilePath: string;         // Where to write plan files
  autoContinue: boolean;        // Auto-continue on sub-agent completion
  phases: string[];            // Allowed phase names
}
```

**Commands from SuperHive**:
```typescript
setOnCommand((cmd, args) => {
  if (cmd === 'reload') {
    // Reload plan from disk
    reloadPlan();
    // Re-stream state
    updateState({ currentTask, phase });
  }
});
```

---

### 3.5 mission-control/ Module

**Role**: Ticket tracking with LLM auto-capture

**Integration with communication**:

```typescript
// mission-control/extension.ts

import { sendInterAgentMessage } from '../../communication/extensions/communication/index.ts';

function createTicket(title: string, description: string, priority: string): Ticket {
  const ticket = doCreateTicket(title, description, priority);

  // Notify via SuperHive
  sendInterAgentMessage(undefined, true, undefined, 'event', {
    type: 'ticket_created',
    ticketId: ticket.id,
    title: ticket.title,
    priority: ticket.priority,
  });

  return ticket;
}

function resolveTicket(ticketId: string, resolution: string): void {
  doResolveTicket(ticketId, resolution);

  // Notify via SuperHive
  sendInterAgentMessage(undefined, true, undefined, 'event', {
    type: 'ticket_resolved',
    ticketId,
  });
}
```

**Settings controlled by SuperHive**:
```typescript
interface MissionControlSettings {
  ticketsPath: string;          // Where to store tickets
  autoCapture: boolean;        // Auto-capture detected tasks
  captureConfidenceThreshold: number; // Min confidence to auto-create
}
```

**SuperHive UI integration**:
- SuperHive renders active tickets in the UI
- User can create/edit/close tickets from SuperHive
- Changes are sent to agent via inter-agent messages

---

## 4. Inter-Module Communication via SuperHive

### 4.1 DM Between Modules (via agents)

```typescript
// In module A: request data from module B on another agent
sendInterAgentMessage('other-agent-id', false, undefined, 'request', {
  type: 'memory_query',
  query: 'authentication tokens',
});

// In module B: handle request
setOnInterAgentMessage((msg) => {
  if (msg.kind === 'request' && msg.payload.type === 'memory_query') {
    const results = mem0Store.search(msg.payload.query);
    sendInterAgentMessage(msg.from, false, undefined, 'response', {
      type: 'memory_results',
      results,
    });
  }
});
```

### 4.2 Broadcast Events

```typescript
// Notify all agents when something significant happens
sendInterAgentMessage(undefined, true, undefined, 'event', {
  type: 'task_complete',
  agentId: getMyAgentId(),
  task: 'auth_module',
  output: { filesModified: 5 },
});
```

### 4.3 Group Messaging

```typescript
// Join a group
// (Group membership is advertised in the manifest's interAgent.groups field)

// Send to group
sendInterAgentMessage(undefined, false, 'software', 'text', 'Build is ready for review');
```

---

## 5. Settings Propagation Flow

```
SuperHive UI (user changes setting)
         │
         ▼
Host sends SETTINGS_UPDATE
         │
         ▼
Communication module receives
         │
         ▼
Validates patch + schema
         │
         ▼
Applies to settings store
         │
         ▼
Emits settings-changed event
         │
         ▼
interested modules receive event
         │
         ▼
Each module applies relevant settings
         │
         ▼
Module acknowledges (via updateState or SETTINGS_APPLIED)
```

---

## 6. Authority Flow

```
Agent A grants authority to Agent B
         │
         ▼
Send AUTHORITY_GRANT to SuperHive
         │
         ▼
SuperHive records grant
         │
         ▼
SuperHive delivers to Agent B
         │
         ▼
Agent B can now perform granted actions
         │
         ▼
(Auto-revoked on disconnect or explicit revoke)
```

---

## 7. Command Propagation Flow

```
User clicks "Pause" in SuperHive UI
         │
         ▼
SuperHive sends COMMAND { command: "pause" }
         │
         ▼
Communication module receives
         │
         ▼
emit 'command' event
         │
         ▼
All registered modules handle
         │
         ▼
(sub-agent pauses, planning pauses, etc.)
```

---

## 8. Data Shared with SuperHive

| Data | Frequency | Via |
|------|-----------|-----|
| Agent identity (manifest) | Once on connect | AGENT_HELLO |
| Current task/phase | Every 30s or on change | AGENT_STATE |
| Active sub-agents | Every 30s or on change | AGENT_STATE |
| Metrics (tokens, tools) | Every 30s | AGENT_STATE |
| Presence status | On change | PRESENCE_UPDATE |
| Permission requests | On demand | PERMISSION_REQUEST |
| Inter-agent messages | On demand | INTER_AGENT_MESSAGE |
| Authority grants | On demand | AUTHORITY_GRANT |

---

## 9. Settings Received from SuperHive

| Setting | Applied by | Effect |
|---------|-----------|--------|
| `maxConcurrent` | sub-agent | Max parallel sub-agents |
| `autoRecall` | mem0 | Toggle auto-memory recall |
| `requireSuperhiveApproval` | permission | Tools needing SuperHive approval |
| `defaultPolicy` | permission | Fallback when SuperHive unreachable |
| `timeoutMs` | permission | Permission request timeout |
| `planFilePath` | planning | Where to write plans |
| `ticketsPath` | mission-control | Where to store tickets |

---

## 10. Example: Full Integration (permission/ + communication/)

```typescript
// permission/extension.ts

import {
  requestPermission,
  setOnSettingsChanged,
} from '../../communication/extensions/communication/index.ts';

interface PermissionSettings {
  requireSuperhiveApproval: string[];
  defaultPolicy: 'allow' | 'deny' | 'ask';
  timeoutMs: number;
}

let settings: PermissionSettings = {
  requireSuperhiveApproval: ['file_delete', 'command_execute'],
  defaultPolicy: 'ask',
  timeoutMs: 120000,
};

setOnSettingsChanged((patch) => {
  for (const op of patch) {
    if (op.path.startsWith('/permission/')) {
      const key = op.path.replace('/permission/', '');
      if (op.op === 'replace' || op.op === 'add') {
        (settings as Record<string, unknown>)[key] = op.value;
      }
    }
  }
});

async function enforce(tool: string, args: unknown): Promise<'allow' | 'deny'> {
  // Check if SuperHive override is needed
  if (settings.requireSuperhiveApproval.includes(tool)) {
    const decision = await requestPermission(tool, args, `Request: ${tool}`, getSeverity(tool), settings.timeoutMs);
    return decision.decision;
  }

  // Fall back to local rules
  return checkLocalRules(tool, args, settings.defaultPolicy);
}
```
