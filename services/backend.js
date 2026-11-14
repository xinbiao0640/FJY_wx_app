const config = require('./config')
const { createClient } = require('./http-client')
module.exports = createClient({ wx, config, role: () => getApp().globalData.role || 'customer' })
