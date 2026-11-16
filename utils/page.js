const api=require('../services/api')
const titles={home:'丰嘉盈',activities:'发现好活动',assets:'我的权益',profile:'我的',login:'登录丰嘉盈',shop:'商户店铺',activity:'活动详情',claim:'确认领取',result:'领取结果',h5:'模拟选号',onboarding:'商户入驻','agent-apply':'申请成为代理',console:'经营工作台','activity-edit':'创建活动',records:'业务记录',wallet:'权益钱包',purchase:'采购权益',refunds:'退款申请',redeem:'商户核销',gifts:'定向礼包',pricebook:'我的价目表',merchants:'名下商户',payables:'转售货款',invite:'邀请商户','profile-edit':'个人资料'}
const tabs={home:0,activities:1,assets:2,profile:3}
function go(url){wx.navigateTo({url})}
function showError(e){wx.showModal({title:'操作未完成',content:(e.message||'请稍后重试')+(e.traceId?'\n追踪号：'+e.traceId:''),showCancel:false})}
module.exports=function(name){return {
 data:{role:'customer',busy:false,form:{},labels:api.labels,mode:'AUTO',filter:'全部',filters:['全部','幸运转盘','刮刮乐','九宫格','直接领取'],assetTab:'权益',phone:'',smsCode:'',agreed:false,countdown:0,code:'',playTypes:['幸运转盘','刮刮乐','九宫格','直接领取'],playIndex:0,pickedNumbers:[],dateText:'11月13日 · 星期五'},
 onLoad(options){this.options=options||{};this.setData({optionsType:options.type||''});this.actionKeys={};this.setData({form:{name:'',contact:'',phone:'',region:'',invite:options.invite||'',quantity:'2',reason:'',price:'2.00',quotaBets:'200',winProbabilityPpm:'250000',perUserLimit:'1',maxWinnerCount:'50',description:'',stock:'100'},numbers:Array.from({length:33},(_,i)=>('0'+(i+1)).slice(-2)),numberChoices:Array.from({length:33},(_,i)=>({n:('0'+(i+1)).slice(-2),selected:false}))});if(name==='profile-edit'){const u=api.read().user;if(u)this.setData({'form.name':u.name})}},
 onShow(){this.visible=true;if(api.sync)this.loadRemote();else this.refresh();if(this.data.countdown&&!this.smsTimer)this.setData({countdown:0});if(this.getTabBar&&Object.prototype.hasOwnProperty.call(tabs,name)){const bar=this.getTabBar();if(bar)bar.setData({selected:tabs[name],role:this.data.role})}wx.setNavigationBarTitle({title:titles[name]});if(name==='result')this.startPolling()},
 onHide(){this.visible=false;this.stopPolling();clearInterval(this.smsTimer);this.smsTimer=null;if(this.codeTimer)clearInterval(this.codeTimer);this.setData({redeemCode:'',countdown:0})},
 onUnload(){this.visible=false;this.stopPolling();clearInterval(this.smsTimer);clearInterval(this.codeTimer)},
 async onPullDownRefresh(){try{if(api.sync)await this.loadRemote();else this.refresh()}finally{wx.stopPullDownRefresh()}},
 async loadRemote(){
  if(this.data.loading)return
  this.refresh()
  this.setData({loading:true,loadError:''})
  try{
   await api.sync();this.refresh()
   if(name==='result'&&this.visible)this.startPolling()
   if(name==='invite'&&!this.data.denied){const r=await api.request('invite',{});this.setData({inviteCode:r.data.code})}
  }catch(e){
   // 同步失败可能清除了过期会话；重新计算权限，网络错误只影响数据提示。
   this.refresh()
   this.setData({loadError:e.message||'数据暂时无法加载，请稍后重试'})
  }finally{this.setData({loading:false})}
 },
 retryLoad(){if(api.sync)return this.loadRemote();this.refresh()},
 refresh(){
  const db=api.read(),role=getApp().globalData.role||'customer';const a=db.activities.find(x=>name==='shop'?x.merchantId===this.options.id:x.id===this.options.id)||db.activities[0]||{};const ownActivities=db.activities.filter(a=>db.merchant&&a.merchantId===db.merchant.id);const roleOrders=db.orders.filter(x=>x.role===role);const rows=this.options.type==='orders'?roleOrders:this.options.type==='redemptions'?db.redemptions:this.options.type==='refunds'?db.refunds.filter(x=>x.role===role):this.options.type==='activities'?ownActivities:db.claims.filter(c=>role!=='merchant'||ownActivities.some(a=>a.id===c.activityId));
  const viewClaims=db.claims.map(x=>Object.assign({},x,{statusText:api.labels[x.status],dateText:new Date(x.date).toLocaleDateString('zh-CN'),canSelect:x.status==='PENDING_SELECTION'}));
  this.setData({consoleMenus:role==='merchant'?[{path:'activity-edit',name:'创建营销活动',icon:'✧'},{path:'records',query:'?type=activities',name:'我的活动',icon:'▦'},{path:'records',name:'顾客领取记录',icon:'▤'},{path:'redeem',name:'券模板与核销',icon:'⌗'},{path:'gifts',name:'定向礼包',icon:'◇'},{path:'wallet',name:'权益钱包',icon:'▣'}]:[{path:'purchase',name:'向平台采购',icon:'▤'},{path:'pricebook',name:'我的转售价目表',icon:'◇'},{path:'merchants',name:'名下商户',icon:'⌂'},{path:'invite',name:'邀请商户',icon:'↗'},{path:'payables',name:'转售货款',icon:'▣'},{path:'wallet',name:'代理库存钱包',icon:'▦'}],role,user:db.user?{name:db.user.name,phone:api.maskPhone(db.user.phone),wechatBound:db.user.wechatBound}:null,merchant:db.merchant,agent:db.agent,activities:db.activities.filter(x=>x.status==='RUNNING'&&(name!=='shop'||x.merchantId===a.merchantId)&&(this.data.filter==='全部'||x.playType===this.data.filter)),ownActivities,a,remaining:(a.quotaBets||0)-(a.occupiedBets||0),probability:((a.winProbabilityPpm||0)/10000).toFixed(0),wallet:db.wallets[role]||db.wallets.merchant,products:db.products.map(p=>Object.assign({},p,{displayPrice:role==='agent'?(p.agentPrice||'待定价'):api.sync?(p.merchantPrice||'待定价'):db.merchant&&db.merchant.agentId?(Number(db.pricebook.price)*p.quantity).toFixed(2):p.merchantPrice})),orders:roleOrders,refunds:db.refunds.filter(x=>x.role===role),ownershipRequests:db.ownershipRequests,couponTemplates:db.couponTemplates,coupons:db.user?db.coupons:[],claims:db.user?viewClaims:[],rows:db.user?rows:[],gifts:db.gifts.map(g=>Object.assign({},g,{maskedPhone:api.maskPhone(g.phone)})),ledgers:db.ledgers.filter(x=>x.role===role),payables:db.payables,pricebook:db.pricebook,merchants:db.merchants||[]})
  if(['result','h5','claim'].includes(name)&&!db.user){this.setData({denied:'请先登录后查看权益'});return}
  if(['console','wallet','purchase','refunds','records','gifts','redeem','activity-edit','pricebook','merchants','payables','invite'].includes(name)){
   if(!db.user){this.setData({denied:'请先登录后进入经营工作台'});return}
   if(!['merchant','agent'].includes(role)||!db[role]||db[role].status!=='APPROVED'){this.setData({denied:'当前身份尚未开通，请完成入驻或申请审核'});return}
   if(['gifts','redeem','activity-edit'].includes(name)&&role!=='merchant'||['pricebook','merchants','payables','invite'].includes(name)&&role!=='agent'){this.setData({denied:'当前身份没有此功能权限'});return}
  }
  this.setData({denied:''})
  if(name==='refunds'&&!this.data.form.orderId&&roleOrders.length)this.setData({'form.orderId':roleOrders[0].id,orderIndex:0})
  if(name==='pricebook')this.setData({'form.price':db.pricebook.price})
  if(name==='result'){const c=db.claims.find(x=>x.id===this.options.id);this.setData({result:c||{status:'NO_WIN',name:'谢谢参与，期待下次幸运',betCount:0,tickets:[]}})}
 },
 input(e){const field=e.currentTarget.dataset.field;this.setData({['form.'+field]:e.detail.value})},
 phoneInput(e){this.setData({phone:e.detail.value})},smsInput(e){this.setData({smsCode:e.detail.value})},agree(e){this.setData({agreed:e.detail.value.length>0})},
 async run(action,payload){if(this.data.busy)return;this.setData({busy:true});const signature=action+JSON.stringify(payload);const key=this.actionKeys[signature]||(this.actionKeys[signature]=api.key());try{const response=await api.request(action,payload,key);delete this.actionKeys[signature];this.refresh();return response.data}catch(e){showError(e);return null}finally{this.setData({busy:false})}},
 async sendSms(){if(this.data.countdown||this.smsSending)return;if(!/^1\d{10}$/.test(this.data.phone)){wx.showToast({title:'请输入有效手机号',icon:'none'});return}if(api.sendSms){this.smsSending=true;try{const r=await api.sendSms(this.data.phone);this.setData({challengeId:r.data.challengeId});wx.showToast({title:'验证码已生成，请查看后端开发控制台',icon:'none'})}catch(e){showError(e);return}finally{this.smsSending=false}}else wx.showModal({title:'Mock 短信',content:'演示验证码为 123456，不发送真实短信。',showCancel:false});this.setData({countdown:60});this.smsTimer=setInterval(()=>{this.setData({countdown:this.data.countdown-1});if(this.data.countdown<=0)clearInterval(this.smsTimer)},1000)},
 async login(){if(!this.data.agreed){wx.showToast({title:'请先勾选同意演示说明',icon:'none'});return}const u=await this.run('login',{phone:this.data.phone,smsCode:this.data.smsCode,challengeId:this.data.challengeId,wechatBound:false});if(u){wx.showToast({title:'登录成功'});setTimeout(()=>this.afterLogin(),350)}},
 afterLogin(){const role=getApp().globalData.role,db=api.read();if(role==='merchant'||role==='agent'){const path=db[role]&&db[role].status==='APPROVED'?'console':role==='merchant'?'onboarding':'agent-apply';wx.redirectTo({url:'/pages/'+path+'/index'});return}wx.navigateBack({delta:1,fail:()=>wx.switchTab({url:'/pages/profile/index'})})},
 async quickLogin(){if(!this.data.agreed){wx.showToast({title:'请先勾选同意演示说明',icon:'none'});return}wx.showModal({title:'模拟手机号快捷登录',content:'使用演示手机号13800138000，模拟微信和手机号已验证；不调用真实微信授权。',success:async r=>{if(r.confirm){const u=await this.run('login',{phone:'13800138000',smsCode:'123456',wechatBound:true});if(u)this.afterLogin()}}})},
 async bindWechat(){wx.showModal({title:'模拟微信绑定',content:'当前使用开发微信适配器模拟绑定，不发起真实微信授权。绑定结果保存在后端。',success:async r=>{if(r.confirm){const result=await this.run('bindWechat',{});if(result)wx.showToast({title:'模拟绑定完成'})}}})},
 open(e){const path=e.currentTarget.dataset.path;if(path)go('/pages/'+path+'/index'+(e.currentTarget.dataset.query||''))},
 openActivity(e){go('/pages/activity/index?id='+e.currentTarget.dataset.id)},
 openShop(){go('/pages/shop/index?id='+this.data.a.merchantId)},
 switchRole(e){const role=e.currentTarget.dataset.role;const db=api.read();getApp().globalData.role=role;wx.setStorageSync('fjy-role',role);if(role==='customer'){this.refresh();if(this.getTabBar&&this.getTabBar())this.getTabBar().setData({role});return}if(!db.user){go('/pages/login/index');return}if(!db[role]||db[role].status!=='APPROVED'){go('/pages/'+(role==='merchant'?'onboarding':'agent-apply')+'/index');return}go('/pages/console/index')},
 selectFilter(e){this.setData({filter:e.currentTarget.dataset.value});this.refresh()},selectAssetTab(e){this.setData({assetTab:e.currentTarget.dataset.value})},selectMode(e){this.setData({mode:e.currentTarget.dataset.value})},
 participate(){if(!this.data.a||!this.data.a.id){wx.showToast({title:'暂无可参与活动',icon:'none'});return}if(!api.read().user){go('/pages/login/index');return}if(!api.read().user.wechatBound){this.bindWechat();return}go('/pages/claim/index?id='+this.data.a.id)},
 async confirmClaim(){if(!this.data.a||!this.data.a.id)return;const c=await this.run('claim',{activityId:this.data.a.id,receiveMode:this.data.mode});if(c)wx.redirectTo({url:'/pages/result/index?id='+(c.id||'NO_WIN')})},
 stopPolling(){if(this.pollTimer){clearInterval(this.pollTimer);this.pollTimer=null}},
 startPolling(){this.stopPolling();const poll=async()=>{const c=this.data.result;if(!c||c.status!=='PROCESSING'){this.stopPolling();return}try{await api.request('pollClaim',{id:c.id});this.refresh()}catch(e){this.stopPolling();showError(e)}};if(this.data.result&&this.data.result.status==='PROCESSING')this.pollTimer=setInterval(poll,2000)},
 openResult(e){go('/pages/result/index?id='+e.currentTarget.dataset.id)},
 selectNumbers(){go('/pages/h5/index?id='+this.data.result.id)},
 toggleNumber(e){const n=e.currentTarget.dataset.n;let picked=this.data.pickedNumbers.slice();if(picked.includes(n))picked=picked.filter(x=>x!==n);else if(picked.length<6)picked.push(n);this.setData({pickedNumbers:picked,numberChoices:this.data.numbers.map(x=>({n:x,selected:picked.includes(x)}))})},
 async finishSelection(){if(this.data.pickedNumbers.length!==6){wx.showToast({title:'请选择6个演示号码',icon:'none'});return}const c=await this.run('selection',{id:this.options.id,numbers:this.data.pickedNumbers});if(c)wx.navigateBack()},
 async submitOnboarding(){const m=await this.run('onboarding',this.data.form);if(m){getApp().globalData.role='merchant';wx.setStorageSync('fjy-role','merchant');wx.redirectTo({url:'/pages/console/index'})}},
 async applyAgent(){const a=await this.run('agentApply',this.data.form);if(a)wx.showToast({title:'申请已提交'})},
 async demoApprove(){const a=await this.run('demoApprove',{});if(a){getApp().globalData.role='agent';wx.setStorageSync('fjy-role','agent');wx.redirectTo({url:'/pages/console/index'})}},
 playChange(e){this.setData({playIndex:Number(e.detail.value)})},
 async saveActivity(){const a=await this.run('activitySave',Object.assign({},this.data.form,{playType:this.data.playTypes[this.data.playIndex]}));if(a){wx.showToast({title:'已保存草稿'});setTimeout(()=>wx.navigateBack(),400)}},
 activityAction(e){const p=e.currentTarget.dataset;wx.showModal({title:p.action==='end'?'结束活动':'确认操作',content:p.action==='end'?'结束后不可恢复，已发权益继续有效。':'确认变更此活动状态？',success:async r=>{if(r.confirm){const a=await this.run('activityAction',{id:p.id,type:p.action});if(a)wx.showToast({title:'操作成功'})}}})},
 buy(e){const productId=e.currentTarget.dataset.id;wx.showModal({title:'模拟支付确认',content:'本次仅模拟服务端支付回调，不产生真实扣款。价格、卖方和入账均由后端确定。',success:async r=>{if(r.confirm){const order=await this.run('purchase',{productId,role:this.data.role});if(order)wx.showModal({title:'模拟支付成功',content:order.quantity+'注已到账\n卖方：'+order.seller+'\n订单：'+order.id,showCancel:false})}}})},
 orderChange(e){const i=Number(e.detail.value);this.setData({orderIndex:i,'form.orderId':this.data.orders[i].id})},
 async submitRefund(){const r=await this.run('refund',{role:this.data.role,orderId:this.data.form.orderId,quantity:this.data.form.quantity,reason:this.data.form.reason});if(r)wx.showModal({title:'退款申请已提交',content:'已冻结'+r.betCount+'注\n原价 ¥'+r.originalAmount+' × '+(Number(r.refundRate)*100).toFixed(0)+'%\n预计退款 ¥'+r.refundAmount+'\n等待审核，不影响已发顾客权益。',showCancel:false})},
 async showCode(e){const c=await this.run('redeemCode',{id:e.currentTarget.dataset.id});if(c){this.setData({redeemCode:c.code,codeRemaining:60});clearInterval(this.codeTimer);this.codeTimer=setInterval(()=>{this.setData({codeRemaining:Math.max(0,this.data.codeRemaining-1)});if(this.data.codeRemaining===0){clearInterval(this.codeTimer);this.setData({redeemCode:''})}},1000)}},
 closeCode(){this.setData({redeemCode:''});clearInterval(this.codeTimer)},
 async redeem(){const r=await this.run('redeem',{code:this.data.form.code});if(r)wx.showModal({title:'核销成功',content:r.name+'\n同一张券不可重复核销',showCancel:false})},
 scan(){wx.scanCode({onlyFromCamera:false,success:r=>this.setData({'form.code':r.result}),fail:()=>wx.showToast({title:'可手动粘贴核销码',icon:'none'})})},
 async createCoupon(){const c=await this.run('couponCreate',this.data.form);if(c)wx.showModal({title:'券模板已创建',content:c.name+' · 库存'+c.stock,showCancel:false})},
 async createGift(){const g=await this.run('giftCreate',this.data.form);if(g)wx.showToast({title:'礼包创建成功'})},
 revokeGift(e){wx.showModal({title:'撤销礼包',content:'仅撤销未领取礼包，预占权益将释放。',success:async r=>{if(r.confirm)await this.run('giftRevoke',{id:e.currentTarget.dataset.id})}})},
 copyGift(e){wx.setClipboardData({data:e.currentTarget.dataset.token})},
 async claimGift(){const g=await this.run('giftClaim',{token:this.data.form.token});if(g)go('/pages/result/index?id='+g.id)},
 async requestOwnership(){const r=await this.run('ownershipRequest',{merchantId:this.data.form.merchantId,reason:this.data.form.reason});if(r)wx.showToast({title:'已提交平台审核'})},
 async savePrice(){const p=await this.run('pricebook',{price:this.data.form.price,version:this.data.pricebook.version});if(p)wx.showToast({title:'转售价已更新'})},
 copyInvite(){if(this.data.inviteCode)wx.setClipboardData({data:this.data.inviteCode})},
 async saveProfile(){const u=await this.run('profile',this.data.form);if(u){wx.showToast({title:'已保存'});setTimeout(()=>wx.navigateBack(),350)}},
 async clearSession(){if(api.logout){try{await api.logout()}catch(e){showError(e)}}else {const db=api.read();db.user=null;wx.setStorageSync('fjy-native-v1',db)}getApp().globalData.role='customer';wx.setStorageSync('fjy-role','customer');wx.switchTab({url:'/pages/profile/index'});this.refresh()},
 logout(){wx.showModal({title:'退出登录',content:'退出后将撤销当前会话并清理角色上下文。',success:async r=>{if(r.confirm)await this.clearSession()}})},
 resetDemo(){wx.showModal({title:api.sync?'清理本机登录状态':'重置演示数据',content:api.sync?'清理本机登录状态，服务端业务记录会保留。':'将清空本地 mock 记录。',success:async r=>{if(r.confirm)await this.clearSession()}})},
 home(){wx.switchTab({url:'/pages/home/index'})},
 onShareAppMessage(){return {title:'丰嘉盈 · 让好生意持续发生',path:'/pages/home/index'}}
}}
