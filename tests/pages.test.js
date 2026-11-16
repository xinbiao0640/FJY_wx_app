require('../services/config').mode='mock'
const {test}=require('node:test')
const assert=require('node:assert/strict')
const app={globalData:{role:'customer'}}
global.getApp=()=>app
global.wx={getStorageSync:()=>'',setStorageSync(){},setNavigationBarTitle(){},stopPullDownRefresh(){},showModal(){},showToast(){}}
const factory=require('../utils/page'),api=require('../services/mock'),config=require('../app.json')
function instance(name){const page=factory(name);page.data=JSON.parse(JSON.stringify(page.data));page.setData=patch=>{for(const [path,value] of Object.entries(patch)){const keys=path.split('.');let obj=page.data;for(const key of keys.slice(0,-1))obj=obj[key]||(obj[key]={});obj[keys.at(-1)]=value}};page.onLoad({});return page}

test('无效活动链接不能回退到其他活动，scene 可定位正确活动',()=>{
  api.reset();app.globalData.role='customer'
  const missing=instance('activity');missing.onLoad({id:'999999'});missing.refresh()
  assert.equal(missing.data.a.id,undefined);assert.match(missing.data.denied,/活动不存在/)
  const scanned=instance('activity');scanned.onLoad({scene:'a%3D3002'});scanned.refresh()
  assert.equal(scanned.data.a.id,'3002');assert.equal(scanned.data.denied,'')
})

test('从活动进入登录后返回原活动，分享链接也保留活动编号',()=>{
  api.reset();app.globalData.role='customer'
  let destination=''
  wx.redirectTo=options=>destination=options.url
  const login=instance('login');login.onLoad({activityId:'3002'});login.afterLogin()
  assert.equal(destination,'/pages/activity/index?id=3002')
  const page=instance('activity');page.onLoad({id:'3002'});page.refresh()
  assert.equal(page.onShareAppMessage().path,'/pages/activity/index?id=3002')
})

test('扫码只查询优惠券，确认后核销；修改输入清除预览',async()=>{
  api.reset();api.transact('login',{phone:'13800138000',smsCode:'123456'})
  api.transact('onboarding',{name:'商户',contact:'店长',phone:'13800138000'});app.globalData.role='merchant'
  const code=api.transact('redeemCode',{id:'5001'}).code
  const page=instance('redeem');page.visible=true;page.refresh()
  wx.scanCode=options=>{assert.equal(options.onlyFromCamera,true);options.success({result:'FJY:COUPON:'+code})}
  page.scan();await new Promise(resolve=>setTimeout(resolve,300))
  assert.equal(page.data.redeemPreview.id,'5001');assert.equal(api.read().redemptions.length,0)
  page.input({currentTarget:{dataset:{field:'code'}},detail:{value:'changed-value'}})
  assert.equal(page.data.redeemPreview,null);await page.redeem();assert.equal(api.read().redemptions.length,0)
  page.setData({'form.code':code});await page.previewRedeem();await page.redeem()
  assert.equal(api.read().redemptions.length,1);assert.equal(page.data.redeemPreview,null)
  page.onUnload()
})

test('用户关闭码弹窗后，迟到的生成响应不能重新显示核销码',async()=>{
  api.reset();api.transact('login',{phone:'13800138000',smsCode:'123456'})
  const page=instance('assets');page.visible=true
  const pending=page.showCode({currentTarget:{dataset:{id:'5001'}}});page.closeCode();await pending
  assert.equal(page.data.codeDialog,false);assert.equal(page.data.redeemCode,'');page.onUnload()
})
test('所有页面初始化成功，未登录经营页面不可见',()=>{api.reset();for(const route of config.pages){const name=route.split('/')[1],p=instance(name);p.onShow();assert.ok(p.data.activities);if(['console','wallet','purchase','refunds','records','gifts','redeem','activity-edit','pricebook','merchants','payables','invite'].includes(name))assert.ok(p.data.denied,name);p.onUnload()}})
test('身份切换时拒绝跨角色业务页，商户工作台可加载',()=>{api.reset();api.transact('login',{phone:'13800138000',smsCode:'123456'});api.transact('onboarding',{name:'测试商户',contact:'店长',phone:'13800138000'});app.globalData.role='merchant';const home=instance('console');home.onShow();assert.equal(home.data.denied,'');assert.ok(home.data.consoleMenus.some(m=>m.path==='gifts'));const agentPage=instance('pricebook');agentPage.onShow();assert.equal(agentPage.data.denied,'当前身份没有此功能权限')})
