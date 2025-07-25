import { createTool } from "@mastra/core";
import { z } from "zod";
import { storage } from "../../storage";
import { nanoid } from "nanoid";

// Bounded Context with Lock/Unlock semantics
interface BoundedContextWithLock {
  id: string;
  name: string;
  type: "metadata" | "architecture" | "module" | "file" | "quality" | "risk";
  description: string;
  data: any;
  relationships: string[];
  lastUpdated: string;
  cost: number;
  lockStatus: 'LOCKED' | 'UNLOCKED';
  unlockWindows: UnlockWindow[];
  version: number;
  complexityScore: number; // κ (kappa) limit for bounded complexity
  teachingSessions: TeachingSession[];
}

interface UnlockWindow {
  id: string;
  start: Date;
  end: Date;
  reason: string;
  changes: ContextChange[];
  cost: number;
  teacherId?: string; // Human teacher who unlocked
}

interface ContextChange {
  timestamp: Date;
  type: 'addition' | 'modification' | 'deletion' | 'relationship_update';
  description: string;
  data: any;
  cost: number;
}

interface TeachingSession {
  id: string;
  contextId: string;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  teachings: Teaching[];
  totalCost: number;
  teacherId?: string;
  studentId?: string; // AI or human learner
}

interface Teaching {
  id: string;
  timestamp: Date;
  input: any;
  learned: any;
  cost: number;
  confidence: number;
  source: 'human' | 'ai' | 'analysis';
}

interface BoundedContextNetwork {
  contexts: BoundedContextWithLock[];
  relationships: ContextRelationship[];
  globalMetrics: {
    totalContexts: number;
    lockedContexts: number;
    unlockedContexts: number;
    totalCost: number;
    averageComplexity: number;
    lastUpdate: Date;
  };
}

interface ContextRelationship {
  from: string;
  to: string;
  type: 'depends_on' | 'informs' | 'tests' | 'documents' | 'extends';
  strength: number; // 0-1 confidence
  lastUpdated: Date;
}

// Bounded Context Manager
class BoundedContextManager {
  private contexts: Map<string, BoundedContextWithLock> = new Map();
  private relationships: Map<string, ContextRelationship> = new Map();
  private readonly MAX_COMPLEXITY = 10; // κ limit
  private readonly COST_PER_UNLOCK = 0.1;
  private readonly COST_PER_TEACHING = 0.05;

  constructor() {
    this.loadContexts();
  }

  private async loadContexts() {
    // Load existing contexts from storage
    // This would integrate with your existing storage system
  }

  async createContext(
    name: string,
    type: BoundedContextWithLock['type'],
    description: string,
    data: any,
    relationships: string[] = []
  ): Promise<BoundedContextWithLock> {
    const context: BoundedContextWithLock = {
      id: nanoid(),
      name,
      type,
      description,
      data,
      relationships,
      lastUpdated: new Date().toISOString(),
      cost: 0,
      lockStatus: 'LOCKED',
      unlockWindows: [],
      version: 1,
      complexityScore: this.calculateComplexity(data),
      teachingSessions: []
    };

    this.contexts.set(context.id, context);
    await this.saveContext(context);
    return context;
  }

  async unlockContext(
    contextId: string,
    reason: string,
    duration: number = 3600000, // 1 hour default
    teacherId?: string
  ): Promise<UnlockWindow> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    if (context.lockStatus === 'UNLOCKED') {
      throw new Error(`Context ${contextId} is already unlocked`);
    }

    const unlockWindow: UnlockWindow = {
      id: nanoid(),
      start: new Date(),
      end: new Date(Date.now() + duration),
      reason,
      changes: [],
      cost: this.COST_PER_UNLOCK,
      teacherId
    };

    context.lockStatus = 'UNLOCKED';
    context.unlockWindows.push(unlockWindow);
    context.cost += this.COST_PER_UNLOCK;

    await this.saveContext(context);
    return unlockWindow;
  }

  async lockContext(contextId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    if (context.lockStatus === 'LOCKED') {
      throw new Error(`Context ${contextId} is already locked`);
    }

    // Find the current unlock window and close it
    const currentWindow = context.unlockWindows.find(w => 
      w.start <= new Date() && w.end >= new Date()
    );

    if (currentWindow) {
      currentWindow.end = new Date();
    }

    context.lockStatus = 'LOCKED';
    context.lastUpdated = new Date().toISOString();

    await this.saveContext(context);
  }

  async startTeachingSession(
    contextId: string,
    teacherId?: string,
    studentId?: string
  ): Promise<TeachingSession> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    if (context.lockStatus === 'LOCKED') {
      throw new Error(`Context ${contextId} is locked. Unlock it first.`);
    }

    const session: TeachingSession = {
      id: nanoid(),
      contextId,
      sessionId: nanoid(),
      startTime: new Date(),
      teachings: [],
      totalCost: 0,
      teacherId,
      studentId
    };

    context.teachingSessions.push(session);
    await this.saveContext(context);
    return session;
  }

  async addTeaching(
    contextId: string,
    sessionId: string,
    input: any,
    learned: any,
    source: 'human' | 'ai' | 'analysis' = 'ai',
    confidence: number = 0.8
  ): Promise<Teaching> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    const session = context.teachingSessions.find(s => s.sessionId === sessionId);
    if (!session) {
      throw new Error(`Teaching session ${sessionId} not found`);
    }

    const teaching: Teaching = {
      id: nanoid(),
      timestamp: new Date(),
      input,
      learned,
      cost: this.COST_PER_TEACHING,
      confidence,
      source
    };

    session.teachings.push(teaching);
    session.totalCost += this.COST_PER_TEACHING;
    context.cost += this.COST_PER_TEACHING;

    // Update context data based on learning
    await this.updateContextFromTeaching(context, teaching);

    await this.saveContext(context);
    return teaching;
  }

  async endTeachingSession(contextId: string, sessionId: string): Promise<void> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    const session = context.teachingSessions.find(s => s.sessionId === sessionId);
    if (!session) {
      throw new Error(`Teaching session ${sessionId} not found`);
    }

    session.endTime = new Date();
    context.lastUpdated = new Date().toISOString();

    await this.saveContext(context);
  }

  async updateContext(
    contextId: string,
    updates: Partial<BoundedContextWithLock['data']>,
    reason: string
  ): Promise<ContextChange> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Context ${contextId} not found`);
    }

    if (context.lockStatus === 'LOCKED') {
      throw new Error(`Context ${contextId} is locked. Unlock it first.`);
    }

    const change: ContextChange = {
      timestamp: new Date(),
      type: 'modification',
      description: reason,
      data: updates,
      cost: 0.05
    };

    // Apply updates
    context.data = { ...context.data, ...updates };
    context.version++;
    context.lastUpdated = new Date().toISOString();
    context.cost += change.cost;

    // Add change to current unlock window
    const currentWindow = context.unlockWindows.find(w => 
      w.start <= new Date() && w.end >= new Date()
    );
    if (currentWindow) {
      currentWindow.changes.push(change);
      currentWindow.cost += change.cost;
    }

    await this.saveContext(context);
    return change;
  }

  async getContextNetwork(): Promise<BoundedContextNetwork> {
    const contexts = Array.from(this.contexts.values());
    const relationships = Array.from(this.relationships.values());

    const globalMetrics = {
      totalContexts: contexts.length,
      lockedContexts: contexts.filter(c => c.lockStatus === 'LOCKED').length,
      unlockedContexts: contexts.filter(c => c.lockStatus === 'UNLOCKED').length,
      totalCost: contexts.reduce((sum, c) => sum + c.cost, 0),
      averageComplexity: contexts.reduce((sum, c) => sum + c.complexityScore, 0) / contexts.length,
      lastUpdate: new Date()
    };

    return {
      contexts,
      relationships,
      globalMetrics
    };
  }

  async scheduleUnlockWindows(
    contextIds: string[],
    schedule: {
      frequency: 'daily' | 'weekly' | 'monthly';
      duration: number; // milliseconds
      reason: string;
    }
  ): Promise<UnlockWindow[]> {
    const windows: UnlockWindow[] = [];

    for (const contextId of contextIds) {
      const context = this.contexts.get(contextId);
      if (!context) continue;

      // Calculate next unlock time based on frequency
      const nextUnlock = this.calculateNextUnlockTime(schedule.frequency);
      
      const window: UnlockWindow = {
        id: nanoid(),
        start: nextUnlock,
        end: new Date(nextUnlock.getTime() + schedule.duration),
        reason: schedule.reason,
        changes: [],
        cost: 0
      };

      context.unlockWindows.push(window);
      windows.push(window);
    }

    await this.saveAllContexts();
    return windows;
  }

  private calculateNextUnlockTime(frequency: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
  }

  private calculateComplexity(data: any): number {
    // Simple complexity calculation based on data size and structure
    const dataSize = JSON.stringify(data).length;
    const structureComplexity = this.analyzeStructureComplexity(data);
    
    return Math.min(this.MAX_COMPLEXITY, Math.floor((dataSize / 10000) + structureComplexity));
  }

  private analyzeStructureComplexity(data: any): number {
    if (typeof data !== 'object' || data === null) return 0;
    
    let complexity = 0;
    
    if (Array.isArray(data)) {
      complexity += data.length * 0.1;
      complexity += data.reduce((sum, item) => sum + this.analyzeStructureComplexity(item), 0);
    } else {
      complexity += Object.keys(data).length * 0.2;
      for (const value of Object.values(data)) {
        complexity += this.analyzeStructureComplexity(value);
      }
    }
    
    return Math.min(5, complexity);
  }

  private async updateContextFromTeaching(context: BoundedContextWithLock, teaching: Teaching) {
    // Update context data based on what was learned
    if (teaching.learned && typeof teaching.learned === 'object') {
      context.data = { ...context.data, ...teaching.learned };
      context.version++;
    }
  }

  private async saveContext(context: BoundedContextWithLock) {
    // Save to storage system
    // This would integrate with your existing storage
    console.log(`💾 Saving context: ${context.name} (v${context.version})`);
  }

  private async saveAllContexts() {
    for (const context of Array.from(this.contexts.values())) {
      await this.saveContext(context);
    }
  }
}

// Create singleton instance
const boundedContextManager = new BoundedContextManager();

// Create the tool
export const boundedContextManagerTool = createTool({
  id: 'bounded-context-manager',
  description: 'Manage bounded contexts with lock/unlock semantics and teaching sessions',
  inputSchema: z.object({
    action: z.enum(['create', 'unlock', 'lock', 'teach', 'update', 'schedule', 'network']),
    contextId: z.string().optional(),
    contextData: z.object({
      name: z.string(),
      type: z.enum(['metadata', 'architecture', 'module', 'file', 'quality', 'risk']),
      description: z.string(),
      data: z.any(),
      relationships: z.array(z.string()).optional(),
    }).optional(),
    unlockData: z.object({
      reason: z.string(),
      duration: z.number().optional(),
      teacherId: z.string().optional(),
    }).optional(),
    teachingData: z.object({
      sessionId: z.string().optional(),
      input: z.any().optional(),
      learned: z.any().optional(),
      source: z.enum(['human', 'ai', 'analysis']).optional(),
      confidence: z.number().optional(),
    }).optional(),
    updateData: z.object({
      updates: z.any(),
      reason: z.string(),
    }).optional(),
    scheduleData: z.object({
      contextIds: z.array(z.string()),
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      duration: z.number(),
      reason: z.string(),
    }).optional(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    result: z.any(),
    message: z.string(),
  }),
  execute: async ({ context }) => {
    if (!context) {
      throw new Error('Context not found');
    }

    const { action, contextId, contextData, unlockData, teachingData, updateData, scheduleData } = context;

    try {
      switch (action) {
        case 'create':
          if (!contextData) throw new Error('Context data required for create action');
          const newContext = await boundedContextManager.createContext(
            contextData.name,
            contextData.type,
            contextData.description,
            contextData.data,
            contextData.relationships
          );
          return {
            success: true,
            result: newContext,
            message: `Created bounded context: ${newContext.name}`
          };

        case 'unlock':
          if (!contextId || !unlockData) throw new Error('Context ID and unlock data required');
          const unlockWindow = await boundedContextManager.unlockContext(
            contextId,
            unlockData.reason,
            unlockData.duration,
            unlockData.teacherId
          );
          return {
            success: true,
            result: unlockWindow,
            message: `Unlocked context: ${contextId}`
          };

        case 'lock':
          if (!contextId) throw new Error('Context ID required');
          await boundedContextManager.lockContext(contextId);
          return {
            success: true,
            result: null,
            message: `Locked context: ${contextId}`
          };

        case 'teach':
          if (!contextId || !teachingData) throw new Error('Context ID and teaching data required');
          let sessionId = teachingData.sessionId;
          
          if (!sessionId) {
            const session = await boundedContextManager.startTeachingSession(
              contextId,
              teachingData.source === 'human' ? 'human' : undefined
            );
            sessionId = session.sessionId;
          }

          if (teachingData.input && teachingData.learned) {
            const teaching = await boundedContextManager.addTeaching(
              contextId,
              sessionId,
              teachingData.input,
              teachingData.learned,
              teachingData.source || 'ai',
              teachingData.confidence || 0.8
            );
            return {
              success: true,
              result: { sessionId, teaching },
              message: `Added teaching to session: ${sessionId}`
            };
          }

          return {
            success: true,
            result: { sessionId },
            message: `Started teaching session: ${sessionId}`
          };

        case 'update':
          if (!contextId || !updateData) throw new Error('Context ID and update data required');
          const change = await boundedContextManager.updateContext(
            contextId,
            updateData.updates,
            updateData.reason
          );
          return {
            success: true,
            result: change,
            message: `Updated context: ${contextId}`
          };

        case 'schedule':
          if (!scheduleData) throw new Error('Schedule data required');
          const windows = await boundedContextManager.scheduleUnlockWindows(
            scheduleData.contextIds,
            {
              frequency: scheduleData.frequency,
              duration: scheduleData.duration,
              reason: scheduleData.reason
            }
          );
          return {
            success: true,
            result: windows,
            message: `Scheduled ${windows.length} unlock windows`
          };

        case 'network':
          const network = await boundedContextManager.getContextNetwork();
          return {
            success: true,
            result: network,
            message: `Retrieved context network with ${network.contexts.length} contexts`
          };

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return {
        success: false,
        result: null,
        message: `Failed to ${action}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },
}); 