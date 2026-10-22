const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../web'),dist=path.resolve(__dirname,'../dist');
function sampleWav(){const rate=8000,samples=8000,b=Buffer.alloc(44+samples*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples*2,40);for(let i=0;i<samples;i++)b.writeInt16LE(Math.round(Math.sin(i/rate*Math.PI*2*220)*1000),44+i*2);return b;}
(async()=>{
const server=http.createServer((q,r)=>{const p=path.join(root,q.url==='/'?'index.html':q.url.split('?')[0]);fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html');r.end(d);});});
await new Promise(r=>server.listen(8765,'0.0.0.0',r));let browser;
try{
browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-crash-reporter','--disable-breakpad']});
const p=await browser.newPage({viewport:{width:1280,height:720},hasTouch:true,isMobile:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:8765');await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>game.state),'menu');
await p.click('#help');assert.match(await p.locator('#dialog-card').innerText(),/八向方向盘/);await p.click('[data-action="helpClose"]');
await p.click('#music-settings');assert.match(await p.locator('#music-current-name').innerText(),/仅播放游戏音效/);
await p.setInputFiles('#music-file',{name:'local-<test>.wav',mimeType:'audio/wav',buffer:sampleWav()});await p.waitForFunction(()=>document.querySelector('.music-feedback').textContent.includes('导入成功'));assert.equal(await p.locator('#music-current-name').innerText(),'local-<test>.wav');
await p.setInputFiles('#music-file',{name:'invalid.wav',mimeType:'audio/wav',buffer:Buffer.from('not an audio file')});await p.waitForFunction(()=>document.querySelector('.music-feedback').textContent.includes('无法解码'));assert.equal(await p.locator('#music-current-name').innerText(),'local-<test>.wav');
await p.reload();await p.click('#music-settings');await p.waitForFunction(()=>document.querySelector('#music-current-name').textContent==='local-<test>.wav');await p.click('[data-action="musicClear"]');await p.waitForFunction(()=>document.querySelector('#music-current-name').textContent.includes('未导入'));await p.click('[data-action="musicClose"]');await p.screenshot({path:path.join(dist,'title.png')});
await p.click('#start');await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>game.state),'playing');
const points=await p.evaluate(()=>['dpad','fire','jump'].map((id,i)=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x+r.width/2+(i===0?r.width*.35:0),y:r.y+r.height/2,id:i+1};}));
const cdp=await p.context().newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await p.waitForTimeout(210);
const move=await p.evaluate(()=>({x:game.player.x,y:game.player.y,shots:game.shots}));assert.ok(move.x>115&&move.y<420&&move.shots>=2,JSON.stringify(move));
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:points.slice(0,2)});await p.waitForTimeout(100);const firing=await p.evaluate(()=>game.shots);assert.ok(firing>=move.shots);
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(150);const stationary=await p.evaluate(()=>game.player.x);await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>game.player.x),stationary);
await p.screenshot({path:path.join(dist,'gameplay.png')});
await p.click('#pause');assert.equal(await p.evaluate(()=>game.state),'paused');const paused=await p.evaluate(()=>game.time);await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>game.time),paused);await p.click('[data-action="resume"]');assert.equal(await p.evaluate(()=>game.state),'playing');
await p.evaluate(()=>gameLifecycle(false));assert.equal(await p.evaluate(()=>game.state),'paused');await p.evaluate(()=>gameLifecycle(true));assert.equal(await p.evaluate(()=>game.state),'paused');await p.click('[data-action="resume"]');
await p.setViewportSize({width:1920,height:864});await p.waitForTimeout(80);assert.equal(await p.locator('#rotate').isVisible(),false);const box=await p.locator('#viewport').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=1920.1);
await p.setViewportSize({width:412,height:915});await p.waitForTimeout(80);assert.equal(await p.locator('#rotate').isVisible(),true);
await p.setViewportSize({width:1280,height:720});await p.waitForTimeout(80);
await p.evaluate(()=>{game.player.x=7900;game.player.y=430;game.player.invuln=999;game.cam=7590;game.player.weapon='S';});await p.waitForTimeout(150);await p.screenshot({path:path.join(dist,'boss.png')});assert.equal(await p.locator('#bossbar').isVisible(),true);
const bossHP=await p.evaluate(()=>game.boss.hp);await p.keyboard.down('KeyJ');await p.waitForTimeout(750);await p.keyboard.up('KeyJ');assert.ok(await p.evaluate(()=>game.boss.hp)<bossHP,'standing horizontal fire reaches the enlarged lower core');
await p.evaluate(()=>{game.boss.turrets.forEach(t=>t.hp=0);game.boss.hp=0;game.bossDefeat=.05;});await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>game.state),'victory');assert.match(await p.locator('#dialog-card').innerText(),/任务完成/);await p.screenshot({path:path.join(dist,'victory.png')});
await p.click('[data-action="restart"]');await p.evaluate(()=>{game.lives=1;game.player.invuln=0;game.damage();game.player.dead=.02;});await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>game.state),'gameover');await p.click('[data-action="continue"]');assert.equal(await p.evaluate(()=>game.state),'playing');assert.equal(await p.evaluate(()=>game.lives),3);
assert.deepEqual(errors,[]);console.log('PASS: title/help; real local WAV import and decode; invalid-file rollback; persisted music restore/clear; three simultaneous touches; release; pause; native lifecycle; landscape ratios; portrait prompt; boss HUD and standing-shot damage; victory/restart; gameover/checkpoint continue; no JavaScript errors.');
}finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
