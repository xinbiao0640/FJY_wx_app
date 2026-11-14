const config = require('./services/config')
App({globalData:{mock:config.mode==='mock',apiBase:config.baseURL,role:'customer'},onLaunch(){this.globalData.role=wx.getStorageSync('fjy-role')||'customer'}})
