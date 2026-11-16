const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),app=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8'))
for(const page of app.pages){for(const ext of ['js','json','wxml','wxss']){assert.ok(fs.existsSync(path.join(root,page+'.'+ext)),page+'.'+ext)}JSON.parse(fs.readFileSync(path.join(root,page+'.json'),'utf8'));new vm.Script(fs.readFileSync(path.join(root,page+'.js'),'utf8'));const wxml=fs.readFileSync(path.join(root,page+'.wxml'),'utf8');assert.ok(!wxml.includes('undefined'));assert.ok(!/\{\{[^}]*\.(?:map|filter|includes)\(/.test(wxml),'WXML不支持JS数组方法')}
assert.equal(app.tabBar.custom,true);assert.equal(app.tabBar.list.length,4);for(const tab of app.tabBar.list)assert.ok(app.pages.includes(tab.pagePath))
const loadStatus=fs.readFileSync(path.join(root,'templates/load-status.wxml'),'utf8')
assert.ok(loadStatus.includes('wx:if="{{loadError}}"'));assert.ok(loadStatus.includes('bindtap="retryLoad"'))
for(const page of app.pages){const wxml=fs.readFileSync(path.join(root,page+'.wxml'),'utf8');const include=wxml.indexOf('<include src="../../templates/load-status.wxml"/>');assert.ok(include>=0&&include<wxml.indexOf('wx:if="{{denied}}"'),page+' 的重试提示应位于权限分支之外')}
console.log('结构检查通过：'+app.pages.length+'个原生页面，4项自定义底部导航。')
