#!/usr/bin/env tsx

// Test the split logic without database access
function splitContentIntoChunks(content: string, chunkSizeBytes: number = 14000): string[] {
  const contentBytes = Buffer.byteLength(content, 'utf8');
  
  if (contentBytes <= chunkSizeBytes) {
    return [content];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  let currentChunkBytes = 0;
  
  // Split by words to preserve word boundaries
  const words = content.split(/\s+/);
  
  for (const word of words) {
    const wordBytes = Buffer.byteLength(word + ' ', 'utf8');
    
    if (currentChunkBytes + wordBytes <= chunkSizeBytes) {
      currentChunk += (currentChunk ? ' ' : '') + word;
      currentChunkBytes += wordBytes;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = word;
      currentChunkBytes = wordBytes;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

function processMetadataForChroma(metadata: Record<string, any>, maxValueSize: number = 256): Record<string, any> {
  const processed: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) {
      continue;
    }
    
    const stringValue = String(value);
    const valueBytes = Buffer.byteLength(stringValue, 'utf8');
    
    if (valueBytes <= maxValueSize) {
      processed[key] = value;
    } else {
      // Truncate metadata value if it's too large
      const truncated = stringValue.substring(0, Math.floor(maxValueSize * 0.9));
      processed[key] = truncated + ' [TRUNCATED]';
    }
  }
  
  return processed;
}

async function testSplitLogic() {
  console.log('🧪 Testing Split Logic');
  console.log('======================\n');

  // Test 1: Large content splitting
  console.log('📄 Test 1: Large content splitting');
  const largeContent = 'This is a very large content that will be split into multiple parts. '.repeat(1000);
  console.log(`   Original size: ${Buffer.byteLength(largeContent, 'utf8')} bytes`);
  
  const chunks = splitContentIntoChunks(largeContent);
  console.log(`   Split into ${chunks.length} chunks`);
  
  for (let i = 0; i < chunks.length; i++) {
    const chunkSize = Buffer.byteLength(chunks[i], 'utf8');
    console.log(`   Chunk ${i + 1}: ${chunkSize} bytes`);
    
    if (chunkSize > 16384) {
      console.log(`   ⚠️ WARNING: Chunk ${i + 1} exceeds ChromaDB limit (${chunkSize} > 16384)`);
    }
  }

  // Test 2: Small content (should not split)
  console.log('\n📄 Test 2: Small content (should not split)');
  const smallContent = 'This is a small content that should not be split.';
  console.log(`   Original size: ${Buffer.byteLength(smallContent, 'utf8')} bytes`);
  
  const smallChunks = splitContentIntoChunks(smallContent);
  console.log(`   Result: ${smallChunks.length} chunk(s)`);
  console.log(`   Content: "${smallChunks[0]}"`);

  // Test 3: Metadata processing
  console.log('\n📄 Test 3: Metadata processing');
  const testMetadata = {
    userId: 123,
    url: 'https://example.com',
    title: 'A normal title',
    largeValue: 'A'.repeat(500), // 500 bytes, exceeds 256 limit
    normalValue: 'Normal value'
  };
  
  console.log(`   Original metadata:`, testMetadata);
  const processedMetadata = processMetadataForChroma(testMetadata);
  console.log(`   Processed metadata:`, processedMetadata);

  // Test 4: Edge case - content exactly at limit
  console.log('\n📄 Test 4: Content exactly at limit');
  const exactSizeContent = 'A'.repeat(14000);
  console.log(`   Content size: ${Buffer.byteLength(exactSizeContent, 'utf8')} bytes`);
  
  const exactChunks = splitContentIntoChunks(exactSizeContent);
  console.log(`   Result: ${exactChunks.length} chunk(s)`);

  console.log('\n✅ Split logic test completed!');
}

// Run the test
testSplitLogic().catch(console.error); 