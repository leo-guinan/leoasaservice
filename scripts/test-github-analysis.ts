#!/usr/bin/env tsx

import 'dotenv/config';
import { storage } from '../server/storage';
import { githubRepoAnalysisTool } from '../server/mastra/tools/github-repo-analysis-tool';

async function testGitHubAnalysis() {
  console.log('🧪 Testing GitHub Repository Analysis');
  console.log('=====================================\n');

  try {
    await storage.initialize();
    console.log('✅ Storage initialized');

    // Test GitHub repository URL
    const testUrl = 'https://github.com/vercel/next.js';
    const testUserId = 2;

    console.log(`🔍 Testing GitHub repository analysis for: ${testUrl}`);
    console.log(`👤 User ID: ${testUserId}`);

    // Check if GitHub token is available
    if (!process.env.GITHUB_TOKEN) {
      console.log('⚠️  GITHUB_TOKEN not found in environment variables');
      console.log('   This test will fail without a GitHub token');
      console.log('   Please add GITHUB_TOKEN to your .env file');
      console.log('   You can get a token from: https://github.com/settings/tokens');
      return;
    }

    console.log('✅ GitHub token found');

    // Run the GitHub analysis
    console.log('\n🚀 Starting GitHub repository analysis...');
    const startTime = Date.now();

    const result = await githubRepoAnalysisTool.execute({
      context: {
        url: testUrl,
        userId: testUserId,
        profileId: 0
      }
    } as any);

    const duration = Date.now() - startTime;

    console.log('\n📊 Analysis Results:');
    console.log('===================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`📝 Message: ${result.message}`);
    console.log(`⏱️  Duration: ${duration}ms`);

    if (result.success) {
      console.log('\n📋 Repository Information:');
      console.log(`   Name: ${result.repository.name}`);
      console.log(`   Description: ${result.repository.description}`);
      console.log(`   Language: ${result.repository.language}`);
      console.log(`   Stars: ${result.repository.stars}`);
      console.log(`   Forks: ${result.repository.forks}`);
      console.log(`   Issues: ${result.repository.issues}`);
      console.log(`   License: ${result.repository.license || 'None'}`);

      console.log('\n🔧 Technology Stack:');
      console.log(`   Primary Language: ${result.techStack.primaryLanguage}`);
      console.log(`   Frameworks: ${result.techStack.frameworks.join(', ') || 'None'}`);
      console.log(`   Package Managers: ${result.techStack.packageManagers.join(', ') || 'None'}`);
      console.log(`   Build Files: ${result.techStack.buildFiles.join(', ') || 'None'}`);
      console.log(`   Deployment Tools: ${result.techStack.deploymentTools.join(', ') || 'None'}`);

      console.log('\n🏗️ Bounded Contexts:');
      console.log(`   Total Contexts: ${result.contexts.length}`);
      result.contexts.forEach((context: any, index: number) => {
        console.log(`   ${index + 1}. ${context.name} (${context.type}) - $${context.cost.toFixed(2)}`);
      });

      console.log('\n💡 Insights:');
      if (result.insights.risks.length > 0) {
        console.log('   🚨 Risks:');
        result.insights.risks.forEach((risk: string) => console.log(`      - ${risk}`));
      }
      if (result.insights.improvements.length > 0) {
        console.log('   🔧 Improvements:');
        result.insights.improvements.forEach((improvement: string) => console.log(`      - ${improvement}`));
      }
      if (result.insights.opportunities.length > 0) {
        console.log('   🎯 Opportunities:');
        result.insights.opportunities.forEach((opportunity: string) => console.log(`      - ${opportunity}`));
      }

      console.log('\n📈 Metrics:');
      console.log(`   Total Contexts: ${result.metrics.totalContexts}`);
      console.log(`   Analysis Duration: ${result.metrics.analysisDuration}ms`);
      console.log(`   Estimated Cost: $${result.metrics.estimatedCost.toFixed(2)}`);

      // Check if the analysis was saved to the database
      console.log('\n💾 Checking database storage...');
      const urls = await storage.getUrls(testUserId);
      const githubUrl = urls.find(url => url.url === testUrl);
      
      if (githubUrl) {
        console.log(`✅ GitHub repository saved to database (ID: ${githubUrl.id})`);
        console.log(`   Title: ${githubUrl.title}`);
        console.log(`   Content Length: ${githubUrl.content?.length || 0} characters`);
        console.log(`   Analysis: ${githubUrl.analysis ? 'Present' : 'Missing'}`);
      } else {
        console.log('❌ GitHub repository not found in database');
      }

    } else {
      console.log('\n❌ Analysis failed');
      console.log(`   Error: ${result.message}`);
    }

    console.log('\n✅ GitHub repository analysis test completed!');

  } catch (error) {
    console.error('❌ GitHub repository analysis test failed:', error);
    process.exit(1);
  }
}

// Run the test
testGitHubAnalysis().catch(console.error); 