const SESSION_KEY = 'fjy-http-session-v1'
const labels = {RUNNING:'进行中',DRAFT:'草稿',PAUSED:'已暂停',ENDED:'已结束',PENDING_SELECTION:'待手选',PROCESSING:'出票中',SUCCESS:'已出票',PARTIAL:'部分成功',FAILED:'出票失败',RELEASED:'已释放',NO_WIN:'未中奖',AVAILABLE:'待使用',REDEEMED:'已核销',EXPIRED:'已过期',CREATED:'待领取',CLAIMED:'已领取',REVOKED:'已撤销',PAID:'已支付',APPLIED:'待审核',PENDING:'审核中',APPROVED:'已通过',REJECTED:'已驳回',UNPAID:'待结算',HELD:'暂挂',SETTLED:'已结算'}
function empty() { return {user:null,merchant:null,agent:null,activities:[],wallets:{merchant:{availableBets:0,frozenBets:0,consumedBets:0,refundedBets:0},agent:{availableBets:0,frozenBets:0,consumedBets:0,refundedBets:0}},couponTemplates:[],claims:[],coupons:[],ownershipRequests:[],redemptions:[],gifts:[],orders:[],refunds:[],ledgers:[],payables:[],merchants:[],products:[],pricebook:{price:'',minPrice:'',version:0}} }
function createClient({wx, config, role = () => 'customer'}) {
  let session = wx.getStorageSync(SESSION_KEY) || null, cache = empty(), refreshing, syncing, epoch = 0
  const key = () => 'wx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12)
  function error(code,message,traceId) { return Object.assign(new Error(message),{code,traceId}) }
  function persist(value) { session = value; if(value)wx.setStorageSync(SESSION_KEY,value);else wx.removeStorageSync(SESSION_KEY) }
  function clear() { epoch++;persist(null);cache=empty();syncing=null;refreshing=null }
  function transport(path, method, data, headers = {}, token) {
    return new Promise((resolve,reject) => wx.request({
      url:config.baseURL.replace(/\/$/,'')+path,method,data,timeout:config.timeout || 15000,
      header:Object.assign({'Content-Type':'application/json'}, token ? {Authorization:'Bearer '+token} : {}, headers),
      success(r) {
        const body=r.data || {}
        if(r.statusCode>=200&&r.statusCode<300&&body.code==='OK')resolve(body)
        else reject(Object.assign(error(body.code||'HTTP_ERROR',body.message||'服务暂不可用',body.traceId),{status:r.statusCode}))
      },
      fail() { reject(error('NETWORK_ERROR','连接后端失败，请检查服务地址和网络')) }
    }))
  }
  async function refreshToken() {
    if(refreshing)return refreshing
    if(!session)throw error('SESSION_EXPIRED','请重新登录')
    const started=epoch, refresh=session.refreshToken
    const pending=(async()=>{
      try {
        const r=await transport('/api/auth/refresh','POST',{refreshToken:refresh})
        if(started!==epoch)throw error('SESSION_EXPIRED','登录状态已变更')
        persist(r.data)
      } catch(e) { if(started===epoch)clear();throw e }
    })()
    refreshing=pending
    try { return await pending } finally { if(refreshing===pending)refreshing=null }
  }
  async function http(path,method='GET',data,headers={}) {
    const started=epoch, token=session&&session.accessToken
    try { const result=await transport(path,method,data,headers,token);if(started!==epoch)throw error('SESSION_EXPIRED','登录状态已变更');return result }
    catch(e) {
      if(e.status!==401||!token||started!==epoch)throw e
      // 同时到达的 401 共用一次刷新；稍晚到达的旧 token 401 直接用新 token。
      if(session&&session.accessToken===token)await refreshToken()
      if(started!==epoch||!session)throw error('SESSION_EXPIRED','请重新登录')
      try {const result=await transport(path,method,data,headers,session.accessToken);if(started!==epoch)throw error('SESSION_EXPIRED','登录状态已变更');return result}
      catch(retryError) {if(retryError.status===401&&started===epoch)clear();throw retryError}
    }
  }
  async function sync() {
    if(syncing)return syncing
    const started=epoch
    const pending=(async()=>{
      const r=await http(session?'/api/miniapp/snapshot':'/api/miniapp/catalog')
      if(started!==epoch)throw error('SESSION_EXPIRED','登录状态已变更')
      cache=Object.assign(empty(),r.data)
      if(session&&r.data.memberships)persist(Object.assign({},session,{memberships:r.data.memberships}))
      return cache
    })()
    syncing=pending
    try {return await pending} finally {if(syncing===pending)syncing=null}
  }
  function headers(action,payload) {
    const merchant=['activitySave','activityAction','activityCode','redeem','redeemPreview','couponCreate','couponIssue','giftCreate','giftRevoke']
    const agent=['ownershipRequest','pricebook','invite']
    const business=merchant.includes(action)?'MERCHANT':agent.includes(action)?'AGENT':(['purchase','refund'].includes(action)?String(payload.role).toUpperCase():null)
    if(!business)return {}
    const membership=session&&(session.memberships||[]).find(m=>m.subjectType===business)
    if(!membership)throw error('PERMISSION_DENIED','当前经营身份未开通，请重新加载')
    return {'X-Membership-Id':membership.id}
  }
  async function request(action,payload={},actionKey) {
    if(action==='login') {
      clear()
      const started=epoch
      const quick=payload.wechatBound===true
      const r=await transport(quick?'/api/miniapp/auth/wechat/login':'/api/auth/phone/login','POST',quick?
        {loginCode:'mock-login-'+payload.phone,phoneCode:'mock-phone-'+payload.phone}:
        {phone:payload.phone,smsCode:payload.smsCode,challengeId:payload.challengeId})
      if(started!==epoch)throw error('SESSION_EXPIRED','登录状态已变更')
      persist(r.data);await sync()
      return Object.assign({},r,{data:cache.user})
    }
    const r=await http('/api/miniapp/actions/'+encodeURIComponent(action),'POST',{payload},Object.assign(headers(action,payload),{'Idempotency-Key':actionKey||key()}))
    await sync()
    return r
  }
  async function logout() {try {if(session)await http('/api/auth/logout','POST',{})} finally {clear()} }
  return {labels,key,read:()=>cache,sync,request,logout,reset:logout,
    activity:id=>http('/api/miniapp/activities/'+encodeURIComponent(id)),
    activityCode:id=>http('/api/miniapp/activities/'+encodeURIComponent(id)+'/code','GET',undefined,headers('activityCode',{})),
    sendSms:phone=>http('/api/auth/sms-codes','POST',{phone,purpose:'LOGIN'}),
    maskPhone:phone=>phone?phone.slice(0,3)+'****'+phone.slice(-4):''}
}
module.exports = { createClient, empty, labels }
