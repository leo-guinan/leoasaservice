
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { weatherWorkflow } from './workflows/weather-workflow';
import { userContextWorkflow } from './workflows/user-context-workflow';
import { weatherAgent } from './agents/weather-agent';
import { userActivityAgent } from './agents/user-activity-agent';
import { contextAgent } from './agents/context-agent';

export const mastra = new Mastra({
  workflows: { weatherWorkflow, userContextWorkflow },
  agents: { weatherAgent, userActivityAgent, contextAgent },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
