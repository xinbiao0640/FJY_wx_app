const {test,beforeEach}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),path=require('node:path')
const {empty}=require('../services/http-client')
const review=require('../utils/review')
require('../services/config').mode='backend'
const app={globalData:{role:'customer'}},storage={}
let state=empty(),destinations=[],calls=[]
global.getApp=()=>app
global.wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,removeStorageSync:k=>delete storage[k],showToast(){},showModal(){},setNavigationBarTitle(){},stopPullDownRefresh(){},navigateTo:o=>destinations.push(o.url),redirectTo:o=>destinations.push(o.url),request(o){
 calls.push(o.url)
 queueMicrotask(()=>{
  let data=state
  if(o.url.endsWith('/phone/login'))data={accessToken:'token',refreshToken:'refresh',memberships:[]}
  else if(o.url.endsWith('/actions/onboarding')||o.url.endsWith('/actions/agentApply')){
   const role=o.url.endsWith('/onboarding')?'merchant':'agent'
   data=state[role]={id:role+'-1',name:o.data.payload.name,status:'PENDING',appliedAt:'2026-11-16T04:00:00Z'}
  }
  o.success({statusCode:200,data:{code:'OK',data}})
 })
}}
const api=require('../services/api'),factory=require('../utils/page')
function page(name){
 const p=factory(name);p.data=JSON.parse(JSON.stringify(p.data));p.setData=patch=>{for(const [key,value] of Object.entries(patch))p.data[key]=value};p.onLoad({});p.visible=true;return p
}
beforeEach(async()=>{
 await api.logout();state=Object.assign(empty(),{user:{id:'1',name:'申请人',phone:'13800000001'},memberships:[]});app.globalData.role='customer';destinations=[];calls=[]
 await api.request('login',{phone:'13800000001',smsCode:'123456',challengeId:'challenge'})
})

test('商户和代理提交后留在状态页，不进入工作台或重复申请',async()=>{
 for(const [name,role,submit] of [['onboarding','merchant','submitOnboarding'],['agent-apply','agent','applyAgent']]){
  const p=page(name);p.data.form={name:'审核测试',phone:'13800000001',contact:'联系人',region:'杭州'}
  await p[submit]();assert.equal(p.data[role].status,'PENDING');assert.equal(p.data[role].appliedAtText,'2026-11-16 12:00:00');assert.equal(destinations.length,0)
  const before=calls.length;await p[submit]();assert.equal(calls.length,before)
  p.enterConsole();assert.equal(destinations.length,0);assert.deepEqual(state.memberships,[])
 }
})

test('平台审核通过后刷新获取审核信息，才允许进入对应工作台',async()=>{
 for(const [name,role] of [['onboarding','merchant'],['agent-apply','agent']]){
  const p=page(name)
  state[role]={id:role+'-1',name:'已通过申请',status:'APPROVED',reviewerId:'9007199254740993',reviewerName:'super',reviewedAt:'2026-11-16T04:30:00Z',reviewDecision:'APPROVE',reviewReason:'资料齐全'}
  await p.retryLoad();assert.equal(p.data[role].reviewerText,'super');assert.equal(p.data[role].reviewedAtText,'2026-11-16 12:30:00');assert.equal(p.data[role].reviewReason,'资料齐全')
  assert.equal(app.globalData.role,role);assert.equal(destinations.at(-1),'/pages/console/index')
 }
})

test('身份入口先同步平台最新结果，已通过直达工作台，待审与驳回查看状态',async()=>{
 const p=page('profile')
 for(const role of ['merchant','agent']){
  for(const status of ['APPROVED','PENDING','REJECTED']){
   state[role]={id:role+'-1',name:'入口测试',status}
   await p.switchRole({currentTarget:{dataset:{role}}})
   assert.equal(destinations.at(-1),status==='APPROVED'?'/pages/console/index':'/pages/'+(role==='merchant'?'onboarding':'agent-apply')+'/index')
   assert.equal(app.globalData.role,role)
  }
 }
})

test('已通过申请默认重定向工作台，只有主动查看审核信息时留在状态页',async()=>{
 for(const [name,role] of [['onboarding','merchant'],['agent-apply','agent']]){
  state[role]={id:role+'-1',name:'已通过',status:'APPROVED'}
  const p=page(name);await p.loadRemote();assert.equal(destinations.at(-1),'/pages/console/index')
  const before=destinations.length;await p.loadRemote();assert.equal(destinations.length,before)
  const details=page(name);details.options.review='1';await details.loadRemote();assert.equal(destinations.length,before);assert.equal(details.data[role].status,'APPROVED')
 }
})

test('被驳回的申请显示原因和审核人，不重新展示申请或启用经营权限',async()=>{
 state.agent={id:'agent-1',name:'被驳回申请',status:'REJECTED',reviewerId:'9007199254740993',reviewedAt:'2026-11-16T04:30:00Z',reviewDecision:'REJECT',reviewReason:'联系电话有误'}
 const p=page('agent-apply');await p.retryLoad();assert.equal(p.data.agent.reviewerText,'9007199254740993');assert.equal(p.data.agent.reviewReason,'联系电话有误')
 const before=calls.length;await p.applyAgent();assert.equal(calls.length,before);p.enterConsole();assert.equal(destinations.length,0)
 app.globalData.role='agent';const consolePage=page('console');consolePage.refresh();assert.match(consolePage.data.denied,/尚未开通/)
})

test('时间固定上海时区，未审核不伪造操作人和时间，页面移除自助审核入口',()=>{
 assert.equal(review.time('2026-11-16T20:30:00Z'),'2026-11-17 04:30:00');assert.equal(review.time(''),'—');assert.equal(review.time(undefined),'—')
 assert.equal(review.view({status:'PENDING'}).reviewerText,'—');assert.equal(review.view(null),null)
 for(const name of ['onboarding','agent-apply']){
  const source=fs.readFileSync(path.join(__dirname,'../pages',name,'index.wxml'),'utf8')
  assert.ok(source.includes('subject-review'));assert.ok(!source.includes('demoApprove'));assert.ok(!source.includes('免审核'))
 }
})
