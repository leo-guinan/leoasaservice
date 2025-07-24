#!/usr/bin/env tsx

// Test date parsing without database access
function generateDateRange(startDate: string, endDate: string): string[] {
  console.log(`🔍 Debug: Generating date range from ${startDate} to ${endDate}`);
  
  const dates: string[] = [];
  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T23:59:59Z');
  
  console.log(`🔍 Debug: Current date object: ${current.toISOString()}`);
  console.log(`🔍 Debug: End date object: ${end.toISOString()}`);
  
  while (current <= end) {
    const dateString = current.toISOString().split('T')[0];
    dates.push(dateString);
    console.log(`🔍 Debug: Added date: ${dateString}`);
    current.setDate(current.getDate() + 1);
  }
  
  console.log(`🔍 Debug: Generated ${dates.length} dates:`, dates);
  return dates;
}

function parseArguments(): { startDate: string; endDate: string } {
  const args = process.argv.slice(2);
  console.log(`🔍 Debug: Command line arguments:`, args);
  
  let startDate: string;
  let endDate: string;
  
  // Check for --start and --end flags
  const startIndex = args.indexOf('--start');
  const endIndex = args.indexOf('--end');
  
  console.log(`🔍 Debug: Start index: ${startIndex}, End index: ${endIndex}`);
  
  if (startIndex !== -1 && args[startIndex + 1]) {
    startDate = args[startIndex + 1];
    console.log(`🔍 Debug: Using provided start date: ${startDate}`);
  } else {
    // Default to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    startDate = yesterday.toISOString().split('T')[0];
    console.log(`🔍 Debug: Using default start date (yesterday): ${startDate}`);
  }
  
  if (endIndex !== -1 && args[endIndex + 1]) {
    endDate = args[endIndex + 1];
    console.log(`🔍 Debug: Using provided end date: ${endDate}`);
  } else {
    // Default to today
    endDate = new Date().toISOString().split('T')[0];
    console.log(`🔍 Debug: Using default end date (today): ${endDate}`);
  }
  
  // Validate dates
  const startDateObj = new Date(startDate + 'T00:00:00Z');
  const endDateObj = new Date(endDate + 'T23:59:59Z');
  
  if (isNaN(startDateObj.getTime())) {
    throw new Error(`Invalid start date: ${startDate}`);
  }
  
  if (isNaN(endDateObj.getTime())) {
    throw new Error(`Invalid end date: ${endDate}`);
  }
  
  if (startDateObj > endDateObj) {
    throw new Error(`Start date (${startDate}) is after end date (${endDate})`);
  }
  
  console.log(`🔍 Debug: Final date range: ${startDate} to ${endDate}`);
  
  return { startDate, endDate };
}

async function testDateParsing() {
  console.log('🧪 Testing Date Parsing');
  console.log('========================\n');

  try {
    const { startDate, endDate } = parseArguments();
    const dates = generateDateRange(startDate, endDate);
    
    console.log(`\n✅ Date parsing test completed!`);
    console.log(`📊 Date range: ${startDate} to ${endDate}`);
    console.log(`📅 Generated ${dates.length} dates`);
    
    if (dates.length > 0) {
      console.log(`📋 Dates: ${dates.join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ Date parsing test failed:', error);
    process.exit(1);
  }
}

// Run the test
testDateParsing().catch(console.error); 