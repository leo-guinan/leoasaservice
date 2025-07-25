import { getDb } from '../server/db';
import { storage } from '../server/storage';
import { chromaService } from '../server/chroma';
import { users, urls, chatMessages } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function testOntologyGeneration() {
  try {
    console.log('🧪 Testing Ontology Generation...\n');

    // Initialize services
    await storage.initialize();
    await chromaService.initialize();

    const db = getDb();

    // Get or create a test user with pro mode
    let testUser = await db.select().from(users).where(eq(users.username, 'testuser')).limit(1);
    
    if (testUser.length === 0) {
      console.log('Creating test user...');
      const newUser = await storage.createUser({
        username: 'testuser',
        password: 'testpass123',
      });
      
      // Enable pro mode
      await storage.updateUserRole(newUser.id, 'admin');
      testUser = [newUser];
    }

    const userId = testUser[0].id;
    console.log(`Using user ID: ${userId}`);

    // Add some test data if none exists
    const existingUrls = await storage.getUrls(userId);
    if (existingUrls.length === 0) {
      console.log('Adding test URLs...');
      await storage.createUrl(userId, {
        url: 'https://example.com/ai-research',
        title: 'AI Research Overview',
        notes: 'Important research on artificial intelligence and machine learning',
        content: 'Artificial intelligence is transforming various industries. Machine learning algorithms are becoming more sophisticated. Deep learning has revolutionized computer vision and natural language processing.',
      });

      await storage.createUrl(userId, {
        url: 'https://example.com/blockchain-tech',
        title: 'Blockchain Technology',
        notes: 'Research on blockchain and distributed systems',
        content: 'Blockchain technology provides decentralized solutions. Smart contracts enable automated transactions. Distributed ledger technology ensures transparency and security.',
      });
    }

    const existingMessages = await storage.getChatMessages(userId);
    if (existingMessages.length === 0) {
      console.log('Adding test chat messages...');
      await storage.createChatMessage(userId, {
        content: 'I\'m researching artificial intelligence and its applications in healthcare',
        role: 'user',
      });

      await storage.createChatMessage(userId, {
        content: 'AI in healthcare shows promise for diagnosis and treatment planning. Machine learning models can analyze medical images and patient data.',
        role: 'assistant',
      });

      await storage.createChatMessage(userId, {
        content: 'What about blockchain applications in supply chain management?',
        role: 'user',
      });

      await storage.createChatMessage(userId, {
        content: 'Blockchain can improve supply chain transparency and traceability. Smart contracts can automate compliance and reduce fraud.',
        role: 'assistant',
      });
    }

    // Test ontology creation
    console.log('\n📊 Creating ontology...');
    const ontologyData = {
      name: 'AI and Blockchain Research Ontology',
      description: 'Knowledge graph of AI and blockchain research areas',
      domain: 'Technology',
      concepts: [
        {
          id: 'concept_1',
          name: 'Artificial Intelligence',
          description: 'Technology that enables machines to simulate human intelligence',
          type: 'Technology',
          confidence: 0.95,
          sources: ['url_content', 'chat_history'],
          properties: {
            frequency: 15,
            domain: 'Technology',
            category: 'AI/ML',
          },
        },
        {
          id: 'concept_2',
          name: 'Machine Learning',
          description: 'Subset of AI that enables systems to learn from data',
          type: 'Technology',
          confidence: 0.88,
          sources: ['url_content', 'chat_history'],
          properties: {
            frequency: 8,
            domain: 'Technology',
            category: 'AI/ML',
          },
        },
        {
          id: 'concept_3',
          name: 'Blockchain',
          description: 'Distributed ledger technology for secure transactions',
          type: 'Technology',
          confidence: 0.92,
          sources: ['url_content', 'chat_history'],
          properties: {
            frequency: 12,
            domain: 'Technology',
            category: 'Distributed Systems',
          },
        },
      ],
      relationships: [
        {
          id: 'rel_1_2',
          source: 'concept_1',
          target: 'concept_2',
          type: 'contains',
          description: 'Artificial Intelligence contains Machine Learning',
          confidence: 0.85,
        },
        {
          id: 'rel_1_3',
          source: 'concept_1',
          target: 'concept_3',
          type: 'related_to',
          description: 'AI and Blockchain are both transformative technologies',
          confidence: 0.75,
        },
      ],
      metadata: {
        totalConcepts: 3,
        totalRelationships: 2,
        generationMethod: 'AI-powered extraction',
        dataSources: ['urls', 'chat_history'],
        processingTime: 1500,
      },
      generatedFrom: {
        urls: existingUrls.length,
        chatMessages: existingMessages.length,
        profileId: 0,
        contextSummary: 'Research focused on AI and blockchain technologies',
      },
    };

    const newOntology = await storage.createOntology(userId, 0, ontologyData);
    console.log(`✅ Created ontology with ID: ${newOntology.id}`);

    // Test ChromaDB storage
    console.log('\n🔍 Testing ChromaDB storage...');
    const ontologyContent = JSON.stringify({
      concepts: ontologyData.concepts,
      relationships: ontologyData.relationships,
      metadata: ontologyData.metadata,
    });

    await chromaService.addOntology({
      id: `ontology_${newOntology.id}`,
      content: ontologyContent,
      metadata: {
        userId,
        profileId: 0,
        ontologyId: newOntology.id,
        domain: 'Technology',
        version: newOntology.version,
        timestamp: new Date().toISOString(),
      },
    });
    console.log('✅ Stored ontology in ChromaDB');

    // Test retrieval
    console.log('\n📖 Testing ontology retrieval...');
    const ontologies = await storage.getOntologies(userId);
    console.log(`Found ${ontologies.length} ontologies for user`);

    if (ontologies.length > 0) {
      const latestOntology = ontologies[0];
      console.log(`Latest ontology: ${latestOntology.name}`);
      console.log(`Concepts: ${latestOntology.concepts.length}`);
      console.log(`Relationships: ${latestOntology.relationships.length}`);
    }

    // Test ChromaDB search
    console.log('\n🔎 Testing ChromaDB search...');
    const searchResults = await chromaService.searchOntologies(userId, 'artificial intelligence', 5);
    console.log(`Found ${searchResults.length} ontology search results`);

    // Test active ontology
    console.log('\n⭐ Testing active ontology...');
    const activeOntology = await storage.getActiveOntology(userId);
    if (activeOntology) {
      console.log(`Active ontology: ${activeOntology.name}`);
    } else {
      console.log('No active ontology found');
    }

    console.log('\n🎉 Ontology generation test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testOntologyGeneration().catch(console.error); 