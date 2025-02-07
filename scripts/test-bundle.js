async function testBundle() {
    try {
      // Test the bundle in conditions similar to Lambda
      const module = await import('../server/index.js');
      console.log('✅ Bundle loaded successfully');
      
      // Test specific features
      const handler = module.handler;
      console.log('✅ Handler found:', !!handler);
      
    } catch (error) {
      console.error('❌ Bundle test failed:', error);
      process.exit(1);
    }
  }
  
  testBundle();