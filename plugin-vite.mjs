import fs from 'fs';

export default {
  deploy: {
    start: ({ arc, inventory }) => {
      // Make sure server directory exists
      if (!fs.existsSync('server')) {
        fs.mkdirSync('server');
      }
      
      // Copy build files
      try {
        fs.copyFileSync(
          'build/index.js',
          'server/index.js'
        );
      } catch (err) {
        console.error('Error copying files:', err);
      }
    }
  }
};