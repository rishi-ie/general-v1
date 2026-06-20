import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { MCEStore } from './store.js';
import type { MetaState, Decision, Goal, Relationship } from './types.js';
import { DEFAULT_META_STATE } from './types.js';

interface RuntimeState {
  store: MCEStore;
  metaState: MetaState;
}

function generateId(prefix: string): string {
  const date = new Date().toISOString().split('T')[0];
  const uuid = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${date}-${uuid}`;
}

function formatSnapshotForInjection(snapshot: ReturnType<MCEStore['buildCognitiveSnapshot']>): string {
  const lines = ['=== COGNITIVE SNAPSHOT ==='];

  lines.push(`\nIdentity: ${snapshot.identity.name} — ${snapshot.identity.role}`);
  if (snapshot.identity.background) {
    lines.push(`Background: ${snapshot.identity.background}`);
  }

  if (snapshot.activeProjects.length > 0) {
    lines.push(`\nActive Projects:`);
    for (const project of snapshot.activeProjects) {
      lines.push(`  - ${project.name}: ${project.description} [${project.status}]`);
    }
  }

  if (snapshot.currentGoals.length > 0) {
    lines.push(`\nCurrent Goals:`);
    for (const goal of snapshot.currentGoals) {
      lines.push(`  - ${goal.title} (${goal.progress}% complete)`);
      if (goal.blockers.length > 0) {
        lines.push(`    Blockers: ${goal.blockers.join(', ')}`);
      }
    }
  }

  if (snapshot.recentDecisions.length > 0) {
    lines.push(`\nRecent Decisions:`);
    for (const decision of snapshot.recentDecisions.slice(0, 3)) {
      lines.push(`  - ${decision.title}: ${decision.rationale.substring(0, 50)}...`);
    }
  }

  if (snapshot.openLoops.length > 0) {
    lines.push(`\nOpen Loops:`);
    for (const loop of snapshot.openLoops) {
      lines.push(`  - [${loop.priority}] ${loop.description}`);
    }
  }

  lines.push(`\nCurrent Focus: ${snapshot.currentFocus || 'None set'}`);

  return lines.join('\n');
}

function registerCommands(pi: ExtensionAPI, state: RuntimeState): void {
  pi.registerCommand('mce status', {
    description: 'Show current cognitive state',
    handler: async () => {
      const meta = state.store.loadMetaState();
      const snapshot = state.store.buildCognitiveSnapshot();

      const lines = [
        `=== MCE STATUS ===`,
        `Last updated: ${meta.lastUpdated}`,
        `\nIdentity: ${meta.identity.name} — ${meta.identity.role}`,
        `\nActive Projects: ${meta.activeProjects.length}`,
        `Active Goals: ${meta.activeGoals.length}`,
        `Recent Decisions: ${meta.recentDecisions.length}`,
        `Open Loops: ${meta.openLoops.length}`,
        `\nCurrent Focus: ${meta.currentFocus || 'Not set'}`,
      ];

      return lines.join('\n');
    },
  });

  pi.registerCommand('mce goals', {
    description: 'List active goals',
    handler: async () => {
      const goals = state.store.loadGoals();
      const active = goals.filter(g => g.status === 'active');

      if (active.length === 0) {
        return 'No active goals';
      }

      const lines = ['=== ACTIVE GOALS ==='];
      for (const goal of active) {
        lines.push(`\n[${goal.id}] ${goal.title}`);
        lines.push(`Progress: ${goal.progress}%`);
        lines.push(`Priority: ${goal.priority}`);
        if (goal.blockers.length > 0) {
          lines.push(`Blockers: ${goal.blockers.join(', ')}`);
        }
        lines.push(`Milestones:`);
        for (const m of goal.milestones) {
          lines.push(`  - [${m.status}] ${m.title}`);
        }
      }

      return lines.join('\n');
    },
  });

  pi.registerCommand('mce decisions', {
    description: 'Show recent decisions',
    handler: async () => {
      const decisions = state.store.loadDecisions();

      if (decisions.length === 0) {
        return 'No decisions recorded';
      }

      const lines = ['=== RECENT DECISIONS ==='];
      for (const decision of decisions.slice(0, 10)) {
        lines.push(`\n[${decision.id}] ${decision.title}`);
        lines.push(`Rationale: ${decision.rationale}`);
        lines.push(`Confidence: ${decision.confidence}`);
        if (decision.outcome) {
          lines.push(`Outcome: ${decision.outcome}`);
        }
      }

      return lines.join('\n');
    },
  });

  pi.registerCommand('mce relationships', {
    description: 'Show known people and teams',
    handler: async () => {
      const relationships = state.store.loadRelationships();

      if (relationships.length === 0) {
        return 'No relationships recorded';
      }

      const lines = ['=== RELATIONSHIPS ==='];
      for (const rel of relationships) {
        lines.push(`\n[${rel.id}] ${rel.name}`);
        lines.push(`Role: ${rel.role} (${rel.type})`);
        lines.push(`Type: ${rel.relationshipType}`);
        lines.push(`Interactions: ${rel.interactionCount}`);
        if (rel.notes) {
          lines.push(`Notes: ${rel.notes}`);
        }
      }

      return lines.join('\n');
    },
  });

  pi.registerCommand('mce snapshot', {
    description: 'Refresh cognitive snapshot',
    handler: async (args: string, ctx) => {
      const snapshot = state.store.buildCognitiveSnapshot();
      state.store.saveSnapshot(snapshot);

      const injection = formatSnapshotForInjection(snapshot);
      ctx.sendMessage({
        customType: 'mce-snapshot',
        content: injection,
        display: false,
      });

      return `Cognitive snapshot refreshed and injected into context`;
    },
  });

  pi.registerCommand('mce track-decision', {
    description: 'Record a decision: /mce track-decision <title> --rationale <why> --evidence <evidence>',
    handler: async (args: string) => {
      const titleMatch = args.match(/^(.+?)(?=\s+--)/);
      const title = titleMatch ? titleMatch[1].trim() : args.trim();

      if (!title) {
        return 'Usage: /mce track-decision <title> --rationale <why> --evidence <evidence>';
      }

      const rationaleMatch = args.match(/--rationale\s+(.+?)(?=\s+--|$)/);
      const evidenceMatch = args.match(/--evidence\s+(.+?)(?=\s+--|$)/);
      const confidenceMatch = args.match(/--confidence\s+(high|medium|low)/);

      const decision: Decision = {
        id: generateId('DEC'),
        title,
        rationale: rationaleMatch ? rationaleMatch[1].trim() : '',
        evidence: evidenceMatch ? evidenceMatch[1].trim() : '',
        confidence: confidenceMatch ? confidenceMatch[1] as Decision['confidence'] : 'medium',
        timestamp: new Date().toISOString(),
      };

      state.store.saveDecision(decision);

      const meta = state.store.loadMetaState();
      meta.recentDecisions = [decision.id, ...meta.recentDecisions.slice(0, 9)];
      meta.lastUpdated = new Date().toISOString();
      state.store.saveMetaState(meta);

      return `Recorded decision [${decision.id}]: ${decision.title}`;
    },
  });

  pi.registerCommand('mce set-focus', {
    description: 'Set current focus: /mce set-focus <description>',
    handler: async (args: string) => {
      const focus = args.trim();
      if (!focus) {
        return 'Usage: /mce set-focus <what you are working on>';
      }

      const meta = state.store.loadMetaState();
      meta.currentFocus = focus;
      meta.lastUpdated = new Date().toISOString();
      state.store.saveMetaState(meta);

      return `Current focus set to: ${focus}`;
    },
  });

  pi.registerCommand('mce add-relationship', {
    description: 'Add a person/team: /mce add-relationship <name> --role <role> --type <person|team|org>',
    handler: async (args: string) => {
      const nameMatch = args.match(/^(.+?)(?=\s+--)/);
      const name = nameMatch ? nameMatch[1].trim() : args.trim();

      if (!name) {
        return 'Usage: /mce add-relationship <name> --role <role> --type <person|team|org>';
      }

      const roleMatch = args.match(/--role\s+(.+?)(?=\s+--|$)/);
      const typeMatch = args.match(/--type\s+(person|team|organization)/);

      const relationship: Relationship = {
        id: generateId('REL'),
        name,
        role: roleMatch ? roleMatch[1].trim() : 'Unknown',
        type: (typeMatch ? typeMatch[1] : 'person') as Relationship['type'],
        relationshipType: 'unknown',
        interactionCount: 0,
        trustScore: 0.5,
        notes: '',
        lastInteraction: new Date().toISOString(),
      };

      const relationships = state.store.loadRelationships();
      relationships.push(relationship);
      state.store.saveRelationships(relationships);

      return `Added relationship [${relationship.id}]: ${relationship.name} (${relationship.role})`;
    },
  });
}

export default function mceExtension(pi: ExtensionAPI): void {
  const store = new MCEStore(pi.cwd);
  const metaState = store.loadMetaState();

  const state: RuntimeState = {
    store,
    metaState,
  };

  registerCommands(pi, state);

  pi.on('session_start', async (_event, ctx) => {
    const snapshot = store.buildCognitiveSnapshot();
    store.saveSnapshot(snapshot);

    const injection = formatSnapshotForInjection(snapshot);
    ctx.sendMessage({
      customType: 'mce-snapshot',
      content: injection,
      display: false,
    });
  });

  pi.on('before_agent_start', async (event, ctx) => {
    const snapshot = store.buildCognitiveSnapshot();
    const injection = formatSnapshotForInjection(snapshot);

    ctx.sendMessage({
      customType: 'mce-snapshot',
      content: injection,
      display: false,
    });
  });

  pi.on('turn_end', async (_event, ctx) => {
    const meta = store.loadMetaState();
    meta.lastUpdated = new Date().toISOString();
    store.saveMetaState(meta);
  });
}
