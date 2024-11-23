module.exports = {
    deploy: {
      start: ({ arc, inventory }) => {
        // Make sure server directory exists
        const fs = require('fs')
        if (!fs.existsSync('server')) {
          fs.mkdirSync('server')
        }
        
        // Copy build files
        fs.copyFileSync(
          'build/server/index.js',
          'server/index.js'
        )
      }
    }
  }