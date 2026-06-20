export interface MetaState {
  identity: Identity;
  activeProjects: Project[];
  activeGoals: string[];
  recentDecisions: string[];
  openLoops: OpenLoop[];
  learnedPatterns: string[];
  currentFocus: string;
  lastUpdated: string;
}

export interface Identity {
  name: string;
  role: string;
  background: string;
  expertise: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'completed';
  startDate: string;
}

export interface OpenLoop {
  id: string;
  description: string;
  source: 'user' | 'self' | 'system';
  priority: 'high' | 'medium' | 'low';
  created: string;
}

export interface Decision {
  id: string;
  title: string;
  rationale: string;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
  timestamp: string;
  outcome?: string;
  linkedGoals?: string[];
}

export interface Goal {
  id: string;
  title: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  priority: 'critical' | 'high' | 'medium' | 'low';
  progress: number;
  milestones: Milestone[];
  blockers: string[];
  created: string;
  updated: string;
}

export interface Milestone {
  id: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  completed?: string;
}

export interface Relationship {
  id: string;
  name: string;
  role: string;
  type: 'person' | 'team' | 'organization';
  relationshipType: string;
  interactionCount: number;
  trustScore: number;
  notes: string;
  lastInteraction: string;
}

export interface CognitiveSnapshot {
  timestamp: string;
  identity: Identity;
  activeProjects: Project[];
  currentGoals: Goal[];
  recentDecisions: Decision[];
  openLoops: OpenLoop[];
  currentFocus: string;
  sessionContext?: string;
}

export const DEFAULT_META_STATE: MetaState = {
  identity: {
    name: 'Digital Employee',
    role: 'Assistant',
    background: '',
    expertise: [],
  },
  activeProjects: [],
  activeGoals: [],
  recentDecisions: [],
  openLoops: [],
  learnedPatterns: [],
  currentFocus: '',
  lastUpdated: new Date().toISOString(),
};
