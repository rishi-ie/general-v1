export type SubAgentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'killed';

export interface SubAgent {
  id: string;
  task: string;
  status: SubAgentStatus;
  created: string;
  updated: string;
  result?: SubAgentResult;
  error?: string;
}

export interface SubAgentResult {
  output: string;
  filesCreated: string[];
  filesModified: string[];
  tasksCompleted: string[];
  memoryStored: number;
}

export interface SubAgentConfig {
  maxConcurrent: number;
  defaultTimeout: number;
  autoCleanup: boolean;
}

export const DEFAULT_CONFIG: SubAgentConfig = {
  maxConcurrent: 3,
  defaultTimeout: 30 * 60 * 1000, // 30 minutes
  autoCleanup: true,
};
