import fs from 'fs';
import path from 'path';

function copyDirectory(source, destination) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  // Read source directory
  const files = fs.readdirSync(source);

  files.forEach(file => {
    const sourcePath = path.join(source, file);
    const destPath = path.join(destination, file);

    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  });
}

export default {
  deploy: {
    start: ({ arc, inventory }) => {
      // Make sure server directory exists
      if (!fs.existsSync('server')) {
        fs.mkdirSync('server');
      }
      
      // Copy server build files
      try {
        fs.copyFileSync(
          'build/index.js',
          'server/index.js'
        );

        // Copy static assets from public/build to .arc/static/build
        const sourceDir = 'public/build';
        const destDir = path.join('.arc', 'static', 'build');
        
        if (fs.existsSync(sourceDir)) {
          copyDirectory(sourceDir, destDir);
        } else {
          console.error('Source directory does not exist:', sourceDir);
        }
      } catch (err) {
        console.error('Error copying files:', err);
      }
    }
  }
};