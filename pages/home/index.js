const page=require('../../utils/page')('home')
Object.assign(page.data,{"roleEntries": [{"role": "customer", "icon": "✧", "name": "我是顾客", "desc": "发现身边小幸运"}, {"role": "merchant", "icon": "⌂", "name": "我是商户", "desc": "让好生意发生"}, {"role": "agent", "icon": "◇", "name": "我是代理", "desc": "携手连接好生意"}]})
Page(page)
