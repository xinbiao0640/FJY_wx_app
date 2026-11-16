const {test}=require('node:test')
const assert=require('node:assert/strict')
const {empty}=require('../services/http-client')
require('../services/config').mode='backend'
const app={globalData:{role:'customer'}},storage={}
let state=empty(),errors=[],offline=false,requestCount=0
global.getApp=()=>app
global.wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,removeStorageSync:k=>delete storage[k],
  setNavigationBarTitle(){},stopPullDownRefresh(){},showModal:e=>errors.push(e),showToast(){},
  request(o){requestCount++;queueMicrotask(()=>offline?o.fail({errMsg:'request:fail connection refused'}):o.success({statusCode:200,data:{code:'OK',data:o.url.endsWith('/phone/login')?{accessToken:'a',refreshToken:'r',memberships:[]}:state}}))}}
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

test('后端不可用时先初始化25个页面，公共页面不被网络错误阻挡且不弹窗',async()=>{
  await api.logout();state=empty();errors=[];offline=true
  const publicPages=['home','activities','assets','profile','login','shop','activity','onboarding','agent-apply','profile-edit']
  try{
    for(const route of config.pages){
      const name=route.split('/')[1],p=instance(name)
      const pending=p.loadRemote()
      assert.deepEqual(p.data.activities,[],name+'请求返回前已初始化')
      assert.equal(p.data.loading,true)
      await pending
      assert.equal(p.data.loading,false)
      assert.match(p.data.loadError,/连接后端失败/)
      if(name==='activity')assert.match(p.data.denied,/活动不存在/)
      else if(name==='claim')assert.match(p.data.denied,/活动不存在/)
      else if(publicPages.includes(name))assert.equal(p.data.denied,'',name)
      else assert.match(p.data.denied,/请先登录/,name)
      p.onUnload()
    }
    assert.deepEqual(errors,[])
    assert.deepEqual(api.read().orders,[])
  }finally{offline=false}
})

test('页面显示时立即渲染，失败后点击重试恢复真实数据，并保留已有数据',async()=>{
  await api.logout();state=empty();errors=[];offline=true
  const p=instance('home')
  try{
    p.onShow()
    assert.deepEqual(p.data.activities,[])
    assert.equal(p.data.denied,'')
    await new Promise(resolve=>setImmediate(resolve))
    assert.match(p.data.loadError,/连接后端失败/)
    offline=false
    state=Object.assign(empty(),{activities:[{id:'real-1',status:'RUNNING',name:'服务端活动'}]})
    const before=requestCount,pending=p.retryLoad()
    await p.retryLoad() // 连点不重复发起请求。
    await pending
    assert.equal(requestCount,before+1)
    assert.equal(p.data.loadError,'')
    assert.equal(p.data.activities[0].id,'real-1')
    offline=true
    await p.onPullDownRefresh()
    assert.match(p.data.loadError,/连接后端失败/)
    assert.equal(p.data.activities[0].id,'real-1')
    assert.equal(p.data.denied,'')
    assert.deepEqual(errors,[])
  }finally{offline=false;p.onUnload();await api.logout();state=empty()}
})

test('断网不覆盖已有经营权限判断，主动提交失败仍提示且不生成记录',async()=>{
  state=Object.assign(empty(),{user:{id:'1',name:'商户',phone:'13800000001'},merchant:{id:'m1',status:'APPROVED'}})
  await api.request('login',{phone:'13800000001',smsCode:'123456',challengeId:'c'})
  app.globalData.role='merchant';offline=true;errors=[]
  try{
    const allowed=instance('console'),denied=instance('pricebook')
    await allowed.loadRemote();await denied.loadRemote()
    assert.equal(allowed.data.denied,'')
    assert.equal(denied.data.denied,'当前身份没有此功能权限')
    assert.match(allowed.data.loadError,/连接后端失败/)
    const login=instance('login')
    assert.equal(await login.run('login',{phone:'13800000001'}),null)
    assert.equal(errors.length,1)
    assert.match(errors[0].content,/连接后端失败/)
    assert.deepEqual(api.read().orders,[])
    allowed.onUnload();denied.onUnload();login.onUnload()
  }finally{offline=false;app.globalData.role='customer';await api.logout();state=empty()}
})
