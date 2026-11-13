App({ globalData: { mock: true, apiBase: '', role: 'customer' }, onLaunch() { this.globalData.role = wx.getStorageSync('fjy-role') || 'customer' } })
