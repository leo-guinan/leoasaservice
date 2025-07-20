#!/usr/bin/env tsx

import 'dotenv/config';
import { mastra } from '../server/mastra/index.js';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface ProcessingResult {
  date: string;
  processedUsers: number;
  updatedContexts: number;
  errors: Array<{
    userId: number;
    username: string;
    error: string;
  }>;
  summary: string;
}

interface OverallResult {
  totalDays: number;
  totalUsersProcessed: number;
  totalContextsUpdated: number;
  totalErrors: number;
  dailyResults: ProcessingResult[];
  overallSummary: string;
}

// Generate array of dates from start to end (inclusive)
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

// Parse command line arguments
function parseArguments(): DateRange {
  const args = process.argv.slice(2);
  let startDate: string;
  let endDate: string;
  
  // Check for --start and --end flags
  const startIndex = args.indexOf('--start');
  const endIndex = args.indexOf('--end');
  
  if (startIndex !== -1 && args[startIndex + 1]) {
    startDate = args[startIndex + 1];
  } else {
    // Default to 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    startDate = thirtyDaysAgo.toISOString().split('T')[0];
  }
  
  if (endIndex !== -1 && args[endIndex + 1]) {
    endDate = args[endIndex + 1];
  } else {
    // Default to today
    endDate = new Date().toISOString().split('T')[0];
  }
  
  return { startDate, endDate };
}

// Process a single day
async function processDay(date: string): Promise<ProcessingResult> {
  console.log(`\n📅 Processing date: ${date}`);
  console.log('─'.repeat(50));
  
  try {
    const workflow = mastra.getWorkflow('userContextWorkflow');
    const run = await workflow.createRunAsync();
    const result = await run.start({
      inputData: {
        date,
      },
    });
    
    if (result.status === 'success') {
      return {
        date,
        processedUsers: result.result.processedUsers,
        updatedContexts: result.result.updatedContexts,
        errors: result.result.errors,
        summary: result.result.summary,
      };
    } else if (result.status === 'failed') {
      throw new Error(`Workflow failed: ${result.error?.message || 'Unknown error'}`);
    } else {
      throw new Error(`Workflow suspended or in unexpected state: ${result.status}`);
    }
  } catch (error) {
    console.error(`❌ Error processing date ${date}:`, error);
    return {
      date,
      processedUsers: 0,
      updatedContexts: 0,
      errors: [{
        userId: 0,
        username: 'SYSTEM',
        error: error instanceof Error ? error.message : 'Unknown error',
      }],
      summary: `Failed to process date ${date}`,
    };
  }
}

// Main processing function
async function updateAllContexts(): Promise<void> {
  const { startDate, endDate } = parseArguments();
  
  console.log('🚀 User Context Update Script');
  console.log('='.repeat(60));
  console.log(`📊 Date Range: ${startDate} to ${endDate}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  const dates = generateDateRange(startDate, endDate);
  console.log(`📋 Will process ${dates.length} days`);
  
  const results: ProcessingResult[] = [];
  let totalUsersProcessed = 0;
  let totalContextsUpdated = 0;
  let totalErrors = 0;
  
  // Process each date
  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    console.log(`\n🔄 Progress: ${i + 1}/${dates.length} (${((i + 1) / dates.length * 100).toFixed(1)}%)`);
    
    const result = await processDay(date);
    results.push(result);
    
    totalUsersProcessed += result.processedUsers;
    totalContextsUpdated += result.updatedContexts;
    totalErrors += result.errors.length;
    
    // Add a small delay to avoid overwhelming the system
    if (i < dates.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Generate overall summary
  const overallResult: OverallResult = {
    totalDays: dates.length,
    totalUsersProcessed,
    totalContextsUpdated,
    totalErrors,
    dailyResults: results,
    overallSummary: `Processed ${dates.length} days, ${totalUsersProcessed} total users, ${totalContextsUpdated} contexts updated, ${totalErrors} total errors`,
  };
  
  // Print final summary
  console.log('\n' + '='.repeat(60));
  console.log('🎯 FINAL SUMMARY');
  console.log('='.repeat(60));
  console.log(`📅 Total Days Processed: ${overallResult.totalDays}`);
  console.log(`👥 Total Users Processed: ${overallResult.totalUsersProcessed}`);
  console.log(`🔄 Total Contexts Updated: ${overallResult.totalContextsUpdated}`);
  console.log(`❌ Total Errors: ${overallResult.totalErrors}`);
  console.log(`⏰ Completed at: ${new Date().toISOString()}`);
  
  if (overallResult.totalErrors > 0) {
    console.log('\n❌ Errors Summary:');
    const errorDates = results.filter(r => r.errors.length > 0);
    errorDates.forEach(result => {
      console.log(`  📅 ${result.date}: ${result.errors.length} errors`);
      result.errors.forEach(error => {
        console.log(`    - ${error.username}: ${error.error}`);
      });
    });
  }
  
  // Print daily breakdown
  console.log('\n📊 Daily Breakdown:');
  results.forEach(result => {
    const successRate = result.processedUsers > 0 
      ? ((result.processedUsers - result.errors.length) / result.processedUsers * 100).toFixed(1)
      : '0.0';
    console.log(`  📅 ${result.date}: ${result.processedUsers} users, ${result.updatedContexts} updates, ${result.errors.length} errors (${successRate}% success)`);
  });
  
  console.log('\n✅ Script completed successfully!');
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  updateAllContexts().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
} 