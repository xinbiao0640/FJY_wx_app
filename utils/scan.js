function activityId(options = {}) {
  if (/^[1-9]\d{0,19}$/.test(options.id || '')) return options.id
  if (!options.scene) return ''
  try {
    const scene = decodeURIComponent(options.scene)
    const match = /^a=([1-9]\d{0,19})$/.exec(scene)
    return match ? match[1] : ''
  } catch (_) { return '' }
}

function parseScan(result) {
  const text = String(result.result || '').trim()
  const coupon = /^FJY:COUPON:([A-Za-z0-9_-]{8,128})$/.exec(text)
  if (coupon) return {type:'coupon', code:coupon[1]}
  const path = String(result.path || '')
  const match = /^\/?pages\/activity\/index\?(.+)$/.exec(path)
  if (match) {
    const options = {}
    try {
      for (const pair of match[1].split('&')) {
        const at = pair.indexOf('=')
        if (at > 0) options[pair.slice(0, at)] = decodeURIComponent(pair.slice(at + 1))
      }
      const id = activityId(options)
      if (id) return {type:'activity', id}
    } catch (_) {}
  }
  throw new Error('未识别到本平台活动码或优惠券核销码')
}

function manualCode(value) {
  const text = String(value || '').trim()
  return text.replace(/^FJY:COUPON:/, '')
}

function writeImage(base64, filename) {
  return new Promise((resolve, reject) => {
    const path = wx.env.USER_DATA_PATH + '/' + filename + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.png'
    wx.getFileSystemManager().writeFile({filePath:path, data:base64, encoding:'base64',
      success:()=>resolve(path), fail:()=>reject(new Error('二维码图片加载失败，请重试'))})
  })
}
function removeImage(path) {
  if (path) wx.getFileSystemManager().unlink({filePath:path, fail:()=>{}})
}
module.exports = {activityId, parseScan, manualCode, writeImage, removeImage}
