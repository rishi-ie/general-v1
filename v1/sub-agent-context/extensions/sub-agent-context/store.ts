import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { MetaState, Decision, Goal, Relationship, CognitiveSnapshot } from './types.js';
import { DEFAULT_META_STATE } from './types.js';

const BASE_DIR = '.mumbrane';

export class MCEStore {
  constructor(private cwd: string) {}

  private ensureDirectory(): void {
    const base = resolve(this.cwd, BASE_DIR);
    if (!existsSync(base)) {
      mkdirSync(base, { recursive: true });
    }
  }

  private getMetaStatePath(): string {
    return resolve(this.cwd, BASE_DIR, 'meta-state.json');
  }

  private getDecisionsDir(): string {
    return resolve(this.cwd, BASE_DIR, 'decisions');
  }

  private getGoalsDir(): string {
    return resolve(this.cwd, BASE_DIR, 'goals');
  }

  private getRelationshipsPath(): string {
    return resolve(this.cwd, BASE_DIR, 'relationships.json');
  }

  private getSnapshotPath(): string {
    return resolve(this.cwd, BASE_DIR, 'snapshot.json');
  }

  loadMetaState(): MetaState {
    this.ensureDirectory();
    const path = this.getMetaStatePath();
    if (!existsSync(path)) {
      return { ...DEFAULT_META_STATE };
    }
    try {
      const content = readFileSync(path, 'utf-8');
      return JSON.parse(content);
    } catch {
      return { ...DEFAULT_META_STATE };
    }
  }

  saveMetaState(state: MetaState): void {
    this.ensureDirectory();
    const path = this.getMetaStatePath();
    writeFileSync(path, JSON.stringify(state, null, 2), 'utf-8');
  }

  loadDecisions(): Decision[] {
    this.ensureDirectory();
    const dir = this.getDecisionsDir();
    if (!existsSync(dir)) return [];

    const { readdirSync, readFileSync: read } = require('node:fs');
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    const decisions: Decision[] = [];

    for (const file of files) {
      try {
        const content = read(resolve(dir, file), 'utf-8');
        decisions.push(JSON.parse(content));
      } catch {
        // Skip invalid files
      }
    }

    return decisions.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  saveDecision(decision: Decision): void {
    this.ensureDirectory();
    const dir = this.getDecisionsDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const path = resolve(dir, `${decision.id}.json`);
    writeFileSync(path, JSON.stringify(decision, null, 2), 'utf-8');
  }

  loadGoals(): Goal[] {
    this.ensureDirectory();
    const dir = this.getGoalsDir();
    if (!existsSync(dir)) return [];

    const { readdirSync, readFileSync: read } = require('node:fs');
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));
    const goals: Goal[] = [];

    for (const file of files) {
      try {
        const content = read(resolve(dir, file), 'utf-8');
        goals.push(JSON.parse(content));
      } catch {
        // Skip invalid files
      }
    }

    return goals.sort((a, b) =>
      new Date(b.updated).getTime() - new Date(a.updated).getTime()
    );
  }

  saveGoal(goal: Goal): void {
    this.ensureDirectory();
    const dir = this.getGoalsDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const path = resolve(dir, `${goal.id}.json`);
    writeFileSync(path, JSON.stringify(goal, null, 2), 'utf-8');
  }

  loadRelationships(): Relationship[] {
    this.ensureDirectory();
    const path = this.getRelationshipsPath();
    if (!existsSync(path)) return [];

    try {
      const content = readFileSync(path, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  saveRelationships(relationships: Relationship[]): void {
    this.ensureDirectory();
    const path = this.getRelationshipsPath();
    writeFileSync(path, JSON.stringify(relationships, null, 2), 'utf-8');
  }

  loadSnapshot(): CognitiveSnapshot | null {
    this.ensureDirectory();
    const path = this.getSnapshotPath();
    if (!existsSync(path)) return null;

    try {
      const content = readFileSync(path, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  saveSnapshot(snapshot: CognitiveSnapshot): void {
    this.ensureDirectory();
    const path = this.getSnapshotPath();
    writeFileSync(path, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  buildCognitiveSnapshot(): CognitiveSnapshot {
    const metaState = this.loadMetaState();
    const recentDecisions = this.loadDecisions().slice(0, 5);
    const activeGoals = this.loadGoals().filter(g => g.status === 'active');

    return {
      timestamp: new Date().toISOString(),
      identity: metaState.identity,
      activeProjects: metaState.activeProjects,
      currentGoals: activeGoals,
      recentDecisions,
      openLoops: metaState.openLoops,
      currentFocus: metaState.currentFocus,
    };
  }
}
