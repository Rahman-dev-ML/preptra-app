// Test script for batch MCQ generation
// Run this in the browser console or as a Node script with fetch available

async function testBatchGeneration() {
  console.log('Testing batch MCQ generation...\n');
  
  const subjects = ['Pakistan Affairs', 'Political Science', 'Economics'];
  const difficulties = ['EASY', 'MEDIUM', 'HARD'];
  
  for (const subject of subjects) {
    for (const difficulty of difficulties) {
      console.log(`\nTesting ${subject} - ${difficulty}:`);
      console.time('Generation time');
      
      try {
        const response = await fetch('http://localhost:3000/api/generate-mcq', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subject,
            difficulty,
            count: 15
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          console.error('❌ Error:', error);
          continue;
        }
        
        const data = await response.json();
        console.log(`✅ Generated ${data.generated} MCQs`);
        console.log(`   From cache: ${data.fromCache || false}`);
        console.log(`   Partial: ${data.partial || false}`);
        
        // Verify MCQ structure
        if (data.mcqs && data.mcqs.length > 0) {
          const sample = data.mcqs[0];
          console.log(`   Sample question: "${sample.question.substring(0, 50)}..."`);
          console.log(`   Has ${sample.options.length} options`);
        }
        
      } catch (error) {
        console.error('❌ Request failed:', error.message);
      }
      
      console.timeEnd('Generation time');
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n\nTesting concurrent requests (simulating multiple users)...');
  
  // Test concurrent requests
  const concurrentPromises = [];
  for (let i = 0; i < 10; i++) {
    const promise = fetch('http://localhost:3000/api/generate-mcq', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject: subjects[i % subjects.length],
        difficulty: difficulties[i % difficulties.length],
        count: 5
      })
    });
    concurrentPromises.push(promise);
  }
  
  console.time('10 concurrent requests');
  const results = await Promise.allSettled(concurrentPromises);
  console.timeEnd('10 concurrent requests');
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.ok);
  console.log(`✅ ${successful.length}/10 requests successful`);
  
  console.log('\n✅ Batch MCQ generation test complete!');
}

// Run the test
testBatchGeneration().catch(console.error);
