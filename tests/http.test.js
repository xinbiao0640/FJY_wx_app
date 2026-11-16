const {test}=require('node:test')
const assert=require('node:assert/strict')
const {createClient,empty}=require('../services/http-client')
const envelope=data=>({statusCode:200,data:{code:'OK',data}})
const unauthorized=()=>({statusCode:401,data:{code:'UNAUTHORIZED',message:'登录过期'}})
const session={accessToken:'old',refreshToken:'refresh',memberships:[{id:'m-1',subjectType:'MERCHANT',subjectId:'1001'}]}
const snapshot=()=>Object.assign(empty(),{user:{id:'1',name:'测试用户',phone:'138****0001',wechatBound:true},memberships:session.memberships})
function setup(handler,stored=session,role='merchant') {
  const calls=[],storage={};if(stored)storage['fjy-http-session-v1']=stored
  const wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,removeStorageSync:k=>delete storage[k],
    request(options){calls.push(options);Promise.resolve().then(()=>handler(options,calls)).then(response=>{if(response instanceof Error)options.fail(response);else options.success(response)},e=>options.fail(e))}}
  return {client:createClient({wx,config:{baseURL:'http://localhost:8080'},role:()=>role}),calls,storage}
}
test('未登录加载空目录，不从本地 mock 造活动',async()=>{
  const {client,calls}=setup(()=>envelope(empty()),null)
  await client.sync();assert.deepEqual(client.read().activities,[]);assert.match(calls[0].url,/\/catalog$/);assert.equal(calls[0].header.Authorization,undefined)
})
test('短信使用 challengeId，登录后读取服务端状态',async()=>{
  const {client,calls}=setup(o=>o.url.endsWith('/sms-codes')?envelope({challengeId:'c1'}):o.url.endsWith('/phone/login')?envelope(session):envelope(snapshot()),null)
  assert.equal((await client.sendSms('13800000001')).data.challengeId,'c1')
  await client.request('login',{phone:'13800000001',smsCode:'654321',challengeId:'c1'})
  assert.equal(calls[1].data.challengeId,'c1');assert.equal(client.read().user.id,'1')
})
test('经营操作带服务端 Membership 和稳定幂等键',async()=>{
  const {client,calls}=setup(o=>envelope(o.url.endsWith('/snapshot')?snapshot():{id:'order1'}))
  const result=await client.request('purchase',{role:'merchant',productId:'950100'},'stable-key-123')
  assert.equal(calls[0].header['X-Membership-Id'],'m-1');assert.equal(calls[0].header['Idempotency-Key'],'stable-key-123')
  assert.equal(calls[0].data.payload.productId,'950100');assert.equal(result.data.id,'order1')
  await assert.rejects(client.request('purchase',{role:'agent',productId:'950100'}),{code:'PERMISSION_DENIED'})
})

test('发券、核销预览和活动码均携带商户 Membership，活动详情公开可读',async()=>{
  const {client,calls}=setup(o=>envelope(o.url.endsWith('/snapshot')?snapshot():{id:'123'}))
  await client.request('couponIssue',{templateId:'10',phone:'13800000001',quantity:1},'coupon-issue-key')
  await client.request('redeemPreview',{code:'12345678'},'coupon-preview-key')
  await client.activityCode('123')
  for(const call of calls.filter(o=>o.url.includes('/actions/')||o.url.endsWith('/code')))assert.equal(call.header['X-Membership-Id'],'m-1')
  const publicClient=setup(()=>envelope({id:'123'}),null)
  assert.equal((await publicClient.client.activity('123')).data.id,'123')
  assert.equal(publicClient.calls[0].header.Authorization,undefined)
})
test('并发401只轮换一次令牌，重试保留幂等键',async()=>{
  let releaseRefresh,oldRequests=0
  const gate=new Promise(resolve=>releaseRefresh=resolve)
  const {client,calls}=setup(async o=>{
    if(o.url.endsWith('/refresh')){await gate;return envelope(Object.assign({},session,{accessToken:'new',refreshToken:'rotated'}))}
    if(o.header.Authorization==='Bearer old'){oldRequests++;if(oldRequests===2)releaseRefresh();return unauthorized()}
    return envelope(o.url.endsWith('/snapshot')?snapshot():{ok:true})
  })
  await Promise.all([client.request('profile',{name:'一'},'stable-key-one'),client.request('profile',{name:'二'},'stable-key-two')])
  assert.equal(calls.filter(o=>o.url.endsWith('/refresh')).length,1)
  const retried=calls.filter(o=>o.url.includes('/actions/')&&o.header.Authorization==='Bearer new')
  assert.deepEqual(retried.map(o=>o.header['Idempotency-Key']).sort(),['stable-key-one','stable-key-two'])
})
test('刷新失败清理所有用户数据，不回退本地余额',async()=>{
  let expired=false
  const {client,storage}=setup(o=>expired?unauthorized():envelope(snapshot()))
  await client.sync();expired=true
  await assert.rejects(client.sync());assert.equal(client.read().user,null);assert.deepEqual(client.read().orders,[])
  assert.equal(storage['fjy-http-session-v1'],undefined)
})
test('退出时丢弃尚未返回的旧账号快照',async()=>{
  let finish
  const gate=new Promise(resolve=>finish=resolve)
  const {client}=setup(o=>o.url.endsWith('/snapshot')?gate:envelope(null))
  const pending=client.sync();await client.logout();finish(envelope(snapshot()))
  await assert.rejects(pending,{code:'SESSION_EXPIRED'});assert.equal(client.read().user,null)
})
test('后端网络失败不会生成成功业务记录',async()=>{
  const {client}=setup(()=>new Error('offline'))
  await assert.rejects(client.request('purchase',{role:'merchant',productId:'950100'},'network-key-1'),{code:'NETWORK_ERROR'})
  assert.deepEqual(client.read().orders,[]);assert.equal(client.read().wallets.merchant.availableBets,0)
})
