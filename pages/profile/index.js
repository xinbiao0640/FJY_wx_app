const page=require('../../utils/page')('profile')
Object.assign(page.data,{"roleMenus": [{"role": "customer", "name": "顾客身份", "icon": "✧"}, {"role": "merchant", "name": "商户经营台", "icon": "⌂"}, {"role": "agent", "name": "代理工作台", "icon": "◇"}]})
Page(page)
