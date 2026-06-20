import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { SubAgent, SubAgentResult, SubAgentConfig } from './types.js';
import { DEFAULT_CONFIG } from './types.js';

interface RuntimeState {
  agents: Map<string, SubAgent>;
  config: SubAgentConfig;
}

function generateId(): string {
  return `sa-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function formatAgentForDisplay(agent: SubAgent): string {
  const parts = [
    `[${agent.id}]`,
    `"${agent.task.substring(0, 50)}${agent.task.length > 50 ? '...' : ''}"`,
    `| status: ${agent.status}`,
  ];

  if (agent.status === 'completed' && agent.result) {
    parts.push(`| files: ${agent.result.filesCreated.length + agent.result.filesModified.length}`);
  }

  if (agent.error) {
    parts.push(`| error: ${agent.error.substring(0, 30)}...`);
  }

  return parts.join(' ');
}

function registerCommands(pi: ExtensionAPI, state: RuntimeState): void {
  pi.registerCommand('subagent new', {
    description: 'Spawn a new sub-agent: /subagent new <task description>',
    handler: async (args: string, ctx) => {
      const task = args.trim();
      if (!task) {
        return 'Usage: /subagent new <task description>';
      }

      if (state.agents.size >= state.config.maxConcurrent) {
        return `Max concurrent sub-agents reached (${state.config.maxConcurrent}). Wait for one to complete or kill an existing agent.`;
      }

      const id = generateId();
      const now = new Date().toISOString();

      const agent: SubAgent = {
        id,
        task,
        status: 'pending',
        created: now,
        updated: now,
      };

      state.agents.set(id, agent);

      ctx.ui.notify(`Sub-agent spawned: [${id}] "${task.substring(0, 40)}..."`, 'info');

      return `Spawned sub-agent [${id}] for task: "${task}"`;
    },
  });

  pi.registerCommand('subagent list', {
    description: 'List all active sub-agents: /subagent list',
    handler: async () => {
      if (state.agents.size === 0) {
        return 'No active sub-agents';
      }

      const lines = ['Active sub-agents:'];
      for (const agent of state.agents.values()) {
        lines.push(formatAgentForDisplay(agent));
      }

      return lines.join('\n');
    },
  });

  pi.registerCommand('subagent status', {
    description: 'Check sub-agent status: /subagent status <id>',
    handler: async (args: string) => {
      const id = args.trim().split(/\s+/)[0];
      if (!id) {
        return 'Usage: /subagent status <id>';
      }

      const agent = state.agents.get(id);
      if (!agent) {
        return `Sub-agent [${id}] not found`;
      }

      const lines = [
        `Sub-agent: ${agent.id}`,
        `Task: ${agent.task}`,
        `Status: ${agent.status}`,
        `Created: ${agent.created}`,
        `Updated: ${agent.updated}`,
      ];

      if (agent.error) {
        lines.push(`Error: ${agent.error}`);
      }

      if (agent.result) {
        lines.push('\nResults:');
        lines.push(`Output: ${agent.result.output.substring(0, 100)}...`);
        lines.push(`Files created: ${agent.result.filesCreated.length}`);
        lines.push(`Files modified: ${agent.result.filesModified.length}`);
        lines.push(`Tasks completed: ${agent.result.tasksCompleted.length}`);
      }

      return lines.join('\n');
    },
  });

  pi.registerCommand('subagent kill', {
    description: 'Terminate a sub-agent: /subagent kill <id>',
    handler: async (args: string) => {
      const id = args.trim().split(/\s+/)[0];
      if (!id) {
        return 'Usage: /subagent kill <id>';
      }

      const agent = state.agents.get(id);
      if (!agent) {
        return `Sub-agent [${id}] not found`;
      }

      agent.status = 'killed';
      agent.updated = new Date().toISOString();

      return `Terminated sub-agent [${id}]: "${agent.task}"`;
    },
  });

  pi.registerCommand('subagent results', {
    description: 'Get sub-agent results: /subagent results <id>',
    handler: async (args: string) => {
      const id = args.trim().split(/\s+/)[0];
      if (!id) {
        return 'Usage: /subagent results <id>';
      }

      const agent = state.agents.get(id);
      if (!agent) {
        return `Sub-agent [${id}] not found`;
      }

      if (agent.status !== 'completed') {
        return `Sub-agent [${id}] is ${agent.status}. No results available yet.`;
      }

      if (!agent.result) {
        return `Sub-agent [${id}] completed but has no results.`;
      }

      const result = agent.result;
      const lines = [
        `=== SUB-AGENT RESULTS [${id}] ===`,
        `\nOutput:`,
        result.output,
        `\nFiles created (${result.filesCreated.length}):`,
        ...result.filesCreated.map(f => `  - ${f}`),
        `\nFiles modified (${result.filesModified.length}):`,
        ...result.filesModified.map(f => `  - ${f}`),
        `\nTasks completed (${result.tasksCompleted.length}):`,
        ...result.tasksCompleted.map(t => `  - ${t}`),
        `\nMemories stored: ${result.memoryStored}`,
      ];

      return lines.join('\n');
    },
  });
}

export default function subAgentExtension(pi: ExtensionAPI): void {
  const state: RuntimeState = {
    agents: new Map(),
    config: DEFAULT_CONFIG,
  };

  registerCommands(pi, state);

  pi.on('session_start', async () => {
    state.agents.clear();
  });

  pi.on('session_shutdown', async () => {
    if (state.config.autoCleanup) {
      for (const [id, agent] of state.agents) {
        if (agent.status === 'running' || agent.status === 'pending') {
          agent.status = 'killed';
          agent.updated = new Date().toISOString();
        }
      }
    }
    state.agents.clear();
  });
}
