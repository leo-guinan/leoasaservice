#!/usr/bin/env tsx

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

async function setupResearchDatabase() {
  console.log('🔧 Setting up Research Database...');
  
  try {
    // Check if PostgreSQL is running
    console.log('📊 Checking PostgreSQL status...');
    try {
      execSync('pg_isready', { stdio: 'pipe' });
      console.log('✅ PostgreSQL is running');
    } catch (error) {
      console.log('❌ PostgreSQL is not running. Please start PostgreSQL first.');
      console.log('   On macOS with Homebrew: brew services start postgresql');
      console.log('   On Ubuntu: sudo systemctl start postgresql');
      return;
    }

    // Create database if it doesn't exist
    console.log('🗄️  Creating database...');
    try {
      execSync('createdb researchbuddy', { stdio: 'pipe' });
      console.log('✅ Database created successfully');
    } catch (error) {
      console.log('ℹ️  Database might already exist, continuing...');
    }

    // Add DATABASE_URL to .env if not present
    console.log('📝 Updating .env file...');
    const envPath = join(process.cwd(), '.env');
    let envContent = '';
    
    try {
      envContent = readFileSync(envPath, 'utf8');
    } catch (error) {
      envContent = '';
    }

    if (!envContent.includes('DATABASE_URL')) {
      const databaseUrl = 'DATABASE_URL=postgresql://localhost:5432/researchbuddy\n';
      writeFileSync(envPath, databaseUrl + envContent);
      console.log('✅ Added DATABASE_URL to .env');
    } else {
      console.log('ℹ️  DATABASE_URL already exists in .env');
    }

    // Run migration
    console.log('🔄 Running database migration...');
    execSync('npm run db:migrate', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: 'postgresql://localhost:5432/researchbuddy' }
    });
    
    console.log('✅ Research database setup completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Start the development server: npm run dev');
    console.log('   2. Access the research manager in your application');
    console.log('   3. Create research requests and generate reports');
    
  } catch (error) {
    console.error('❌ Error setting up research database:', error);
    process.exit(1);
  }
}

// Run the setup
setupResearchDatabase().catch(console.error); 