#!/usr/bin/env tsx

import 'dotenv/config';
import { boundedContextManagerTool } from '../server/mastra/tools/bounded-context-manager';

async function testBoundedContexts() {
  console.log('🧪 Testing Bounded Context Manager');
  console.log('==================================\n');

  try {
    // Test 1: Create a bounded context
    console.log('📝 Test 1: Creating a bounded context');
    const createResult = await boundedContextManagerTool.execute({
      context: {
        action: 'create',
        contextData: {
          name: 'nextjs-architecture',
          type: 'architecture',
          description: 'Next.js application architecture analysis',
          data: {
            type: 'modular',
            confidence: 0.85,
            modules: ['components', 'pages', 'api', 'utils'],
            patterns: ['SSR', 'API Routes', 'File-based Routing']
          },
          relationships: []
        }
      }
    } as any);

    console.log(`✅ Create result: ${createResult.message}`);
    const contextId = createResult.result.id;
    console.log(`   Context ID: ${contextId}`);

    // Test 2: Unlock the context
    console.log('\n🔓 Test 2: Unlocking the context');
    const unlockResult = await boundedContextManagerTool.execute({
      context: {
        action: 'unlock',
        contextId,
        unlockData: {
          reason: 'Initial analysis and learning',
          duration: 3600000, // 1 hour
          teacherId: 'human-analyst'
        }
      }
    } as any);

    console.log(`✅ Unlock result: ${unlockResult.message}`);
    console.log(`   Unlock window: ${unlockResult.result.start} to ${unlockResult.result.end}`);

    // Test 3: Start a teaching session
    console.log('\n📚 Test 3: Starting a teaching session');
    const teachResult = await boundedContextManagerTool.execute({
      context: {
        action: 'teach',
        contextId,
        teachingData: {
          source: 'human',
          confidence: 0.9
        }
      }
    } as any);

    console.log(`✅ Teaching session started: ${teachResult.message}`);
    const sessionId = teachResult.result.sessionId;
    console.log(`   Session ID: ${sessionId}`);

    // Test 4: Add teachings to the session
    console.log('\n🎓 Test 4: Adding teachings to the session');
    const teachingResult = await boundedContextManagerTool.execute({
      context: {
        action: 'teach',
        contextId,
        teachingData: {
          sessionId,
          input: 'Next.js uses file-based routing in the pages directory',
          learned: {
            routingPattern: 'file-based',
            directory: 'pages',
            examples: ['/about -> pages/about.js', '/blog/[id] -> pages/blog/[id].js']
          },
          source: 'human',
          confidence: 0.95
        }
      }
    } as any);

    console.log(`✅ Teaching added: ${teachingResult.message}`);
    console.log(`   Teaching ID: ${teachingResult.result.teaching.id}`);

    // Test 5: Update the context
    console.log('\n✏️ Test 5: Updating the context');
    const updateResult = await boundedContextManagerTool.execute({
      context: {
        action: 'update',
        contextId,
        updateData: {
          updates: {
            routingPattern: 'file-based',
            additionalPatterns: ['Dynamic Routes', 'API Routes']
          },
          reason: 'Learned about Next.js routing patterns'
        }
      }
    } as any);

    console.log(`✅ Context updated: ${updateResult.message}`);
    console.log(`   Change type: ${updateResult.result.type}`);

    // Test 6: Schedule unlock windows
    console.log('\n📅 Test 6: Scheduling unlock windows');
    const scheduleResult = await boundedContextManagerTool.execute({
      context: {
        action: 'schedule',
        scheduleData: {
          contextIds: [contextId],
          frequency: 'weekly',
          duration: 7200000, // 2 hours
          reason: 'Weekly architecture review and updates'
        }
      }
    } as any);

    console.log(`✅ Unlock windows scheduled: ${scheduleResult.message}`);
    console.log(`   Scheduled windows: ${scheduleResult.result.length}`);

    // Test 7: Get context network
    console.log('\n🌐 Test 7: Getting context network');
    const networkResult = await boundedContextManagerTool.execute({
      context: {
        action: 'network'
      }
    } as any);

    console.log(`✅ Network retrieved: ${networkResult.message}`);
    const network = networkResult.result;
    console.log(`   Total contexts: ${network.globalMetrics.totalContexts}`);
    console.log(`   Locked contexts: ${network.globalMetrics.lockedContexts}`);
    console.log(`   Unlocked contexts: ${network.globalMetrics.unlockedContexts}`);
    console.log(`   Total cost: $${network.globalMetrics.totalCost.toFixed(2)}`);
    console.log(`   Average complexity: ${network.globalMetrics.averageComplexity.toFixed(2)}`);

    // Test 8: Lock the context
    console.log('\n🔒 Test 8: Locking the context');
    const lockResult = await boundedContextManagerTool.execute({
      context: {
        action: 'lock',
        contextId
      }
    } as any);

    console.log(`✅ Context locked: ${lockResult.message}`);

    // Display final context details
    console.log('\n📊 Final Context Details:');
    console.log('========================');
    const finalContext = network.contexts.find(c => c.id === contextId);
    if (finalContext) {
      console.log(`   Name: ${finalContext.name}`);
      console.log(`   Type: ${finalContext.type}`);
      console.log(`   Status: ${finalContext.lockStatus}`);
      console.log(`   Version: ${finalContext.version}`);
      console.log(`   Cost: $${finalContext.cost.toFixed(2)}`);
      console.log(`   Complexity: ${finalContext.complexityScore}`);
      console.log(`   Teaching sessions: ${finalContext.teachingSessions.length}`);
      console.log(`   Unlock windows: ${finalContext.unlockWindows.length}`);
      
      if (finalContext.teachingSessions.length > 0) {
        const session = finalContext.teachingSessions[0];
        console.log(`   Last session teachings: ${session.teachings.length}`);
        console.log(`   Session cost: $${session.totalCost.toFixed(2)}`);
      }
    }

    console.log('\n✅ Bounded context manager test completed successfully!');

  } catch (error) {
    console.error('❌ Bounded context manager test failed:', error);
    process.exit(1);
  }
}

// Run the test
testBoundedContexts().catch(console.error); 