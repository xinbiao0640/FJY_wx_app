const {test}=require('node:test')
const assert=require('node:assert/strict')
const {empty}=require('../services/http-client')
require('../services/config').mode='backend'
const app={globalData:{role:'customer'}},storage={}
let state=empty(),errors=[]
global.getApp=()=>app
global.wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,removeStorageSync:k=>delete storage[k],
  setNavigationBarTitle(){},stopPullDownRefresh(){},showModal:e=>errors.push(e),showToast(){},
  request(o){queueMicrotask(()=>o.success({statusCode:200,data:{code:'OK',data:o.url.endsWith('/phone/login')?{accessToken:'a',refreshToken:'r',memberships:[]}:state}}))}}
const factory=require('../utils/page'),api=require('../services/api'),config=require('../app.json')
function instance(name,id) {
  const p=factory(name);p.data=JSON.parse(JSON.stringify(p.data));p.setData=patch=>{for(const [path,v]of Object.entries(patch)){const keys=path.split('.');let obj=p.data;for(const key of keys.slice(0,-1))obj=obj[key]||(obj[key]={});obj[keys.at(-1)]=v}}
  p.onLoad(id?{id}:{});p.visible=true;return p
}
test('后端空库时25个页面可加载，不填充演示活动、商户或余额',async()=>{
  errors=[]
  for(const route of config.pages) {
    const p=instance(route.split('/')[1]);await p.loadRemote()
    assert.deepEqual(p.data.activities,[]);assert.deepEqual(p.data.merchants,[])
    assert.equal(p.data.remaining,0);assert.equal(p.data.probability,'0');p.onUnload()
  }
  assert.deepEqual(errors,[])
})
test('异步领取数据加载后启动轮询，隐藏页面不启动轮询',async()=>{
  state=Object.assign(empty(),{user:{id:'1',name:'顾客',phone:'138****0001',wechatBound:true},memberships:[],claims:[{id:'900',name:'领取',date:'2026-11-14T00:00:00Z',betCount:2,status:'PROCESSING',tickets:[]}]})
  await api.request('login',{phone:'13800000001',smsCode:'123456',challengeId:'c'})
  const p=instance('result','900');await p.loadRemote();assert.ok(p.pollTimer);p.onHide();assert.equal(p.pollTimer,null)
  await p.loadRemote();assert.equal(p.pollTimer,null);p.onUnload()
})
