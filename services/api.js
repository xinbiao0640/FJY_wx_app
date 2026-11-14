const config = require('./config')
module.exports = config.mode === 'mock' ? require('./mock') : require('./backend')
