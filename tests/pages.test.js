require('../services/config').mode='mock'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const app={globalData:{role:'customer'}}
global.getApp=()=>app
global.wx={getStorageSync:()=>'',setStorageSync(){},setNavigationBarTitle(){},stopPullDownRefresh(){},showModal(){},showToast(){}}
const factory=require('../utils/page'),api=require('../services/mock'),config=require('../app.json')
function instance(name){const page=factory(name);page.data=JSON.parse(JSON.stringify(page.data));page.setData=patch=>{for(const [path,value] of Object.entries(patch)){const keys=path.split('.');let obj=page.data;for(const key of keys.slice(0,-1))obj=obj[key]||(obj[key]={});obj[keys.at(-1)]=value}};page.onLoad({});return page}
test('所有页面初始化成功，未登录经营页面不可见',()=>{api.reset();for(const route of config.pages){const name=route.split('/')[1],p=instance(name);p.onShow();assert.ok(p.data.activities);if(['console','wallet','purchase','refunds','records','gifts','redeem','activity-edit','pricebook','merchants','payables','invite'].includes(name))assert.ok(p.data.denied,name);p.onUnload()}})
test('身份切换时拒绝跨角色业务页，商户工作台可加载',()=>{api.reset();api.transact('login',{phone:'13800138000',smsCode:'123456'});api.transact('onboarding',{name:'测试商户',contact:'店长',phone:'13800138000'});app.globalData.role='merchant';const home=instance('console');home.onShow();assert.equal(home.data.denied,'');assert.ok(home.data.consoleMenus.some(m=>m.path==='gifts'));const agentPage=instance('pricebook');agentPage.onShow();assert.equal(agentPage.data.denied,'当前身份没有此功能权限')})
