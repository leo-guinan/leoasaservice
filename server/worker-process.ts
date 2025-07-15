#!/usr/bin/env node

import './worker';

console.log('🚀 Worker process started');
console.log('Processing background jobs...');

// Keep the process alive
process.on('SIGINT', () => {
  console.log('Worker process shutting down...');
  process.exit(0);
}); 