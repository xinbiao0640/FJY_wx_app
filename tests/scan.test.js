const {test}=require('node:test')
const assert=require('node:assert/strict')
const {activityId,parseScan,manualCode}=require('../utils/scan')

test('活动码的 scene 和分享链接保留精确活动编号',()=>{
  assert.equal(activityId({scene:'a%3D1234567890123456789'}),'1234567890123456789')
  assert.deepEqual(parseScan({path:'pages/activity/index?scene=a%3D12345'}),{type:'activity',id:'12345'})
  assert.deepEqual(parseScan({path:'/pages/activity/index?id=12345'}),{type:'activity',id:'12345'})
  assert.equal(activityId({scene:'%E0%A4%A'}),'')
  assert.equal(activityId({id:'wrong-id'}),'')
})

test('二维码与手输动态码使用同一凭证，拒绝任意链接和其他页面',()=>{
  const code='0123456789abcdef0123456789abcdef'
  assert.deepEqual(parseScan({result:'FJY:COUPON:'+code}),{type:'coupon',code})
  assert.equal(manualCode(' FJY:COUPON:'+code+' '),code)
  assert.throws(()=>parseScan({result:'https://example.com/?id=1'}))
  assert.throws(()=>parseScan({path:'pages/redeem/index?code=12345678'}))
  assert.throws(()=>parseScan({path:'pages/activity/index?scene=%'}))
})
