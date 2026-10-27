(function(){
'use strict';
const $=id=>document.getElementById(id);
const audio=new GameAudio(),g=new CampaignGame(name=>audio.sfx(name));
const renderer=new GameRenderer($('game')),baseRenderer=new BaseRenderer($('game'));
window.game=g;window.gameAudio=audio;
let mode='classic',selectedLevel=1,muted=false,previousState='',last=0,acc=0,frame=0,lastTrack='';
let musicDialogOpen=false,musicSelection='jungle';
const keys=new Set(),pointers=new Map();let pad={x:0,y:0},jumpQueued=false,fireHeld=false;
const names={R:'突击步枪',M:'高速机枪',S:'五向散弹',L:'穿透激光'};
const musicTracks={
  jungle:{label:'01 丛林',title:'密林の戦い（メインBGM） / Jungle Battle'},
  base:{label:'02 走廊',title:'迷路要塞1（3D） / Labyrinth Fortress'},
  baseBoss:{label:'02 Boss',title:'迷路要塞2（3Dボス） / Base Boss'}
};
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try{g.best=Number(localStorage.getItem('ja-best'))||0;muted=localStorage.getItem('ja-muted')==='1';}catch(_){}
audio.setMuted(muted);
function trackForGame(){return g.levelNumber===2?(g.baseMode==='boss'?'baseBoss':'base'):'jungle';}
function syncTrack(){const track=trackForGame();if(track!==lastTrack){lastTrack=track;audio.setTrack(track);}}
function resize(){const w=innerWidth,h=innerHeight,s=Math.min(w/960,h/540),v=$('viewport');v.style.transform=`scale(${s})`;v.style.left=(w-960*s)/2+'px';v.style.top=(h-540*s)/2+'px';$('rotate').hidden=w>=h;}
addEventListener('resize',resize);resize();
function syncMute(){for(const id of ['mute','menu-mute']){$(id).textContent=muted?'♪̸':'♫';$(id).setAttribute('aria-label',muted?'开启声音':'关闭声音');}audio.setMuted(muted);}
function mute(){muted=!muted;syncMute();try{localStorage.setItem('ja-muted',muted?'1':'0');}catch(_){}}
syncMute();$('mute').onclick=mute;$('menu-mute').onclick=mute;
function release(){keys.clear();pointers.clear();pad={x:0,y:0};jumpQueued=false;fireHeld=false;$('thumb').style.transform='';$('jump').classList.remove('pressed');$('fire').classList.remove('pressed');}
function refreshMenu(){
  document.querySelectorAll('[data-level]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.level)===selectedLevel));
  const base=selectedLevel===2;
  $('mission-index').textContent=base?'02':'01';$('mission-name').textContent=base?'基地渗透':'丛林前线';$('mission-english').textContent=base?'BASE 1 / INFILTRATION':'JUNGLE FRONTLINE';
  $('mission-intro').innerHTML=base?'穿过高压电网，逐室突进。<br>摧毁防御节点，直面基地机核。':'深入丛林，穿越火线。<br>向前推进，摧毁敌军基地核心。';
  $('level-route').innerHTML='<span class="route-point"></span><b>'+(base?'电网走廊':'丛林入口')+'</b><i></i><span>'+(base?'五区突入':'爆破木桥')+'</span><i></i><span>'+(base?'机核防线':'基地核心')+'</span><em>STAGE '+(base?'02':'01')+' / 02</em>';
}
function start(level=selectedLevel){selectedLevel=level;release();audio.unlock();g.reset(mode,level);syncTrack();audio.start();audio.setPaused(false);previousState='';sync();}
$('start').onclick=()=>start();
document.querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{selectedLevel=Number(b.dataset.level);g.reset(mode,selectedLevel);g.state='menu';syncTrack();refreshMenu();});
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(a=>a.classList.toggle('selected',a===b));});
function dialog(html){$('dialog-card').innerHTML=html;$('dialog').hidden=false;document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>actions[b.dataset.action]());}
function openMusic(){musicSelection=trackForGame();audio.unlock();musicDialog();}
function musicDialog(){
  musicDialogOpen=true;const status=audio.getMusicStatus(musicSelection),info=musicTracks[musicSelection];
  const tabs=Object.entries(musicTracks).map(([key,v])=>'<button data-music-track="'+key+'" class="'+(key===musicSelection?'selected':'')+'">'+v.label+'</button>').join('');
  const current=status.source==='bundled'?'内置原声 · '+status.name:status.ready?'内置音频未就绪':'正在加载内置音频…';
  const feedback=status.error||'配乐随游戏离线播放，进入场景自动切换，无需导入文件。';
  dialog('<div class="dialog-kicker">FC / NES · SOUNDTRACK</div><h2>内置配乐</h2><div class="music-tabs">'+tabs+'</div><p class="music-title">'+escapeHTML(info.title)+'</p><p class="music-title">安装包内置音乐，关卡与 Boss 配乐自动切换并循环播放。</p><div class="music-current"><small>当前场景音乐</small><b id="music-current-name">'+escapeHTML(current)+'</b></div><p class="music-feedback" role="status">'+escapeHTML(feedback)+'</p><div class="dialog-buttons"><button class="primary" data-action="musicToggle">'+(muted?'开启声音':'静音')+' <span>♫</span></button><button class="secondary" data-action="musicClose">返回</button></div>');
  document.querySelectorAll('[data-music-track]').forEach(b=>b.onclick=()=>{musicSelection=b.dataset.musicTrack;musicDialog();});
}
$('music-settings').onclick=openMusic;
addEventListener('game-music-change',()=>{if(musicDialogOpen)musicDialog();});
const actions={
  musicToggle(){mute();musicDialog();},
  musicClose(){musicDialogOpen=false;if(g.state==='paused')pauseDialog();else $('dialog').hidden=true;},
  music:openMusic,
  resume(){g.state='playing';audio.setPaused(false);release();sync();},
  restart(){start(g.levelNumber);},
  menu(){selectedLevel=g.levelNumber;g.state='menu';release();audio.stop();sync();},
  continue(){g.continueGame();release();syncTrack();audio.start();audio.setPaused(false);sync();},
  nextLevel(){if(!g.nextLevel())return;selectedLevel=2;release();syncTrack();audio.start();audio.setPaused(false);sync();},
  helpClose(){if(g.state==='paused')pauseDialog();else $('dialog').hidden=true;}
};
function pauseDialog(){dialog('<div class="dialog-kicker">STAGE 0'+g.levelNumber+' / TAKE A BREATH</div><h2>行动暂停</h2><p>前线等待你的归来。调整呼吸，继续突破。</p><div class="dialog-buttons"><button class="primary" data-action="resume">继续行动 <span>→</span></button><button class="secondary" data-action="music">音乐</button><button class="secondary" data-action="restart">重开本关</button><button class="secondary" data-action="menu">返回标题</button></div>');}
function pause(){if(g.state==='playing'){g.state='paused';audio.setPaused(true);release();sync();}else if(g.state==='paused')actions.resume();}
$('pause').onclick=pause;
function help(){
  const base=(g.state==='menu'?selectedLevel:g.levelNumber)===2;
  const guide=base?[
    ['左右对齐，向前射击','左右移动瞄准红色目标。长按 B 向走廊深处连续射击。'],
    ['下蹲与跳跃','下键蹲伏避开高处子弹；A 跳过地面滚雷。蹲伏时仍可射击。'],
    ['破门推进','摧毁全部红色门核，解除电网；按上向前进入下一区。触碰通电电网会麻痹。'],
    ['机核防线','先摧毁开合炮口与红色传感器，再攻击出现的眼形机核。留意它的火环。']
  ]:[
    ['八向方向盘','左右跑动，上键向上瞄准；斜向可进行对角射击。'],
    ['A 跳跃 / B 射击','长按 B 连续开火，移动、跳跃、射击可同时操作。'],
    ['俯卧与下落','地面按下躲避高处子弹；下 + A 穿过薄平台，水中 A 跃出。'],
    ['武器与生存','击破飞行补给，拾取 M / S / L；B 提供无敌屏障，死亡失去武器。']
  ];
  dialog('<div class="dialog-kicker">STAGE 0'+(base?'2':'1')+' / FIELD MANUAL</div><h2>'+(base?'深入，基地内部':'准备好，突击手')+'</h2><div class="guide">'+guide.map(([a,b])=>'<div><b>'+a+'</b><span>'+b+'</span></div>').join('')+'</div><p class="key-note">键盘：WASD / 方向键移动 · J / Z 射击 · K / X / 空格跳跃 · Esc 暂停<br>'+(base?'五区走廊后进入双阶段关底，可从当前房间继续。':'子弹可击落敌弹与手榴弹，关底底部红色弱点可在地面直射。')+'</p><div class="dialog-buttons"><button class="primary" data-action="helpClose">了解，准备行动 <span>→</span></button></div>');
}
$('help').onclick=help;
function statsHTML(){return '<div class="result-stats"><div><small>任务得分</small><b>'+g.score+'</b></div><div><small>作战时间</small><b>'+formatTime(g.elapsed)+'</b></div><div><small>击破敌军</small><b>'+g.kills+'</b></div></div>';}
function sync(){
  musicDialogOpen=false;const st=g.state;if(st!=='playing')release();syncTrack();refreshMenu();
  $('menu').hidden=st!=='menu';$('hud').hidden=st==='menu';$('touch').hidden=st!=='playing';$('dialog').hidden=true;
  if(st==='paused')pauseDialog();
  if(st==='stageclear'){
    audio.setPaused(true);dialog('<div class="dialog-kicker">STAGE 01 / MISSION COMPLETE</div><h2>第一关 · 突破成功</h2><p>基地入口已被击破，前方是敌军内部走廊。</p>'+statsHTML()+'<div class="stage-carry">携带 <b>'+g.lives+' 条生命</b> 与 <b>'+names[g.player.weapon]+'</b> 进入第二关，得分与进度继续累计。</div><div class="dialog-buttons"><button class="primary" data-action="nextLevel">进入第二关 <span>→</span></button><button class="secondary" data-action="restart">重玩第一关</button><button class="secondary" data-action="menu">返回标题</button></div>');
  }
  if(st==='gameover'){
    audio.setPaused(true);const location=g.levelNumber===2?'第二关 · '+(g.baseMode==='boss'?'机核防线':'第 '+(g.roomIndex+1)+' 区走廊'):'第一关 · 最近检查点';
    dialog('<div class="dialog-kicker">MISSION INTERRUPTED</div><h2>整装，再出发</h2><p>生命已耗尽。可从'+location+'继续，扣除 2,000 分。</p>'+statsHTML()+'<div class="dialog-buttons"><button class="primary" data-action="continue">检查点继续 <span>→</span></button><button class="secondary" data-action="restart">重开本关</button><button class="secondary" data-action="menu">返回标题</button></div>');
  }
  if(st==='victory'){
    dialog('<div class="dialog-kicker">STAGE 02 / MISSION COMPLETE</div><h2>基地，全面突破</h2><p>机核防御系统已被摧毁。第二关任务完成。</p>'+statsHTML()+'<p>最高纪录 '+Math.max(g.best,g.score).toString().padStart(6,'0')+'　/　阵亡 '+g.deaths+' 次</p><div class="dialog-buttons"><button class="primary" data-action="restart">再战第二关 <span>→</span></button><button class="secondary" data-action="menu">返回标题</button></div>');
  }
  if(['stageclear','victory','gameover'].includes(st))try{localStorage.setItem('ja-best',String(Math.max(g.best,g.score)));}catch(_){}
  previousState=st;
}
function formatTime(s){return Math.floor(s/60).toString().padStart(2,'0')+':'+Math.floor(s%60).toString().padStart(2,'0');}
function padMove(e){const r=$('dpad').getBoundingClientRect(),dx=(e.clientX-r.left-r.width/2)/(r.width/2),dy=(e.clientY-r.top-r.height/2)/(r.height/2),len=Math.hypot(dx,dy);if(len<.20)pad={x:0,y:0};else{const d=Math.round(Math.atan2(dy,dx)/(Math.PI/4));pad={x:Math.abs(Math.cos(d*Math.PI/4))>.4?Math.sign(Math.cos(d*Math.PI/4)):0,y:Math.abs(Math.sin(d*Math.PI/4))>.4?Math.sign(Math.sin(d*Math.PI/4)):0};}const div=Math.max(1,len);$('thumb').style.transform=`translate(${dx/div*33}px,${dy/div*33}px)`;}
for(const id of ['dpad','jump','fire']){
  const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();if(g.state!=='playing')return;audio.unlock();b.setPointerCapture(e.pointerId);if(id==='dpad'&&Array.from(pointers.values()).includes('dpad'))return;pointers.set(e.pointerId,id);if(id==='dpad')padMove(e);if(id==='jump'){jumpQueued=true;b.classList.add('pressed');}if(id==='fire'){fireHeld=true;b.classList.add('pressed');}});
  b.addEventListener('pointermove',e=>{if(pointers.get(e.pointerId)==='dpad')padMove(e);});
  const up=e=>{const kind=pointers.get(e.pointerId);pointers.delete(e.pointerId);if(kind==='dpad'){pad={x:0,y:0};$('thumb').style.transform='';}if(kind==='fire'){fireHeld=Array.from(pointers.values()).includes('fire');if(!fireHeld)b.classList.remove('pressed');}if(kind==='jump'&&!Array.from(pointers.values()).includes('jump'))b.classList.remove('pressed');};
  b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
}
const gameKeys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','KeyJ','KeyZ','KeyK','KeyX','Space','Escape','KeyP'];
addEventListener('keydown',e=>{if(!gameKeys.includes(e.code))return;e.preventDefault();if(e.code==='Escape'||e.code==='KeyP'){if(!e.repeat)pause();return;}if(g.state!=='playing')return;if(['KeyK','KeyX','Space'].includes(e.code)&&!e.repeat)jumpQueued=true;keys.add(e.code);});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{if(g.state==='playing')pause();else release();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&g.state==='playing')pause();});
window.gameLifecycle=function(active){if(!active){if(g.state==='playing')pause();else{release();audio.setPaused(true);}}};
window.gameBack=function(){if(musicDialogOpen){actions.musicClose();return;}if(g.state==='playing')pause();else if(g.state==='paused')actions.resume();else if(!$('dialog').hidden&&g.state==='menu')$('dialog').hidden=true;else if(g.state!=='menu')actions.menu();};
function hud(){
  const p=g.player,base=g.levelNumber===2,b=g.boss;
  $('life').textContent=g.lives<=5?'◆ '.repeat(Math.max(0,g.lives)):'◆ × '+g.lives;$('score').textContent=g.score.toString().padStart(6,'0');$('weapon-code').textContent=p.weapon;$('weapon-name').textContent=names[p.weapon]||p.weapon;
  let progress;
  if(base){
    const targets=(g.targets||[]).filter(t=>t.type==='core'),max=targets.reduce((n,t)=>n+t.maxHp,0),left=targets.reduce((n,t)=>n+Math.max(0,t.hp),0);
    progress=(g.roomIndex+(max?1-left/max:0))/(g.roomCount+1)*100;
    $('sector').textContent=g.baseMode==='boss'?'02 / 机核防线':'02 / 基地 · 第'+(g.roomIndex+1)+'区';$('progress-label').textContent=g.baseMode==='boss'?'BOSS':(g.roomIndex+1)+' / '+g.roomCount;
    $('tutorial').textContent=g.phase==='advance'?'电网已解除 · 按 ↑ 前进':'左右对齐目标 · 下蹲避弹 · 跳过滚雷';$('tutorial').hidden=!(g.phase==='advance'||g.time<18);
  }else{
    progress=Math.min(100,p.x/8425*100);$('progress-label').textContent=Math.floor(progress)+'%';$('sector').textContent=['01 / 丛林入口','01 / 爆破木桥','01 / 丛林纵深','01 / 火力封锁','01 / 基地核心'][g.stage];$('tutorial').textContent='方向键瞄准 / 移动 · 长按射击 · 下键俯卧';$('tutorial').hidden=g.elapsed>12||b.active;
  }
  if(g.state==='victory')progress=100;$('progress').style.width=Math.max(0,Math.min(100,progress))+'%';
  $('notice').textContent=g.noticeTime>0?g.notice:'';$('notice').style.opacity=g.noticeTime>0?'1':'0';
  const bossVisible=base?g.baseMode==='boss'&&g.state!=='victory':b.active&&b.hp>0;$('bossbar').hidden=!bossVisible;
  if(bossVisible){
    if(base&&b.phase===1){const nodes=g.targets||[],max=nodes.reduce((n,t)=>n+t.maxHp,0),left=nodes.reduce((n,t)=>n+Math.max(0,t.hp),0);$('boss-health').style.width=(max?left/max*100:0)+'%';$('boss-label').textContent='基地防线 · 摧毁炮口和红色传感器';$('boss-hp').textContent=nodes.filter(t=>t.hp>0).length+' 个节点';}
    else{$('boss-health').style.width=(b.hp/b.maxHp*100)+'%';$('boss-label').textContent=base?'眼形机核 · 躲开火环，持续射击':'基地弱点 · 瞄准底部红色核心';$('boss-hp').textContent=Math.max(0,Math.ceil(b.hp))+' / '+b.maxHp;}
  }
  $('notice').style.top=bossVisible?'111px':'88px';
}
function loop(ts){
  const dt=Math.min((ts-last)/1000||0,.1);last=ts;acc+=dt;let steps=0;
  while(acc>=1/60&&steps++<6){const input={x:pad.x+(keys.has('ArrowRight')||keys.has('KeyD')?1:0)-(keys.has('ArrowLeft')||keys.has('KeyA')?1:0),y:pad.y+(keys.has('ArrowDown')||keys.has('KeyS')?1:0)-(keys.has('ArrowUp')||keys.has('KeyW')?1:0),jump:jumpQueued,fire:fireHeld||keys.has('KeyJ')||keys.has('KeyZ')};g.update(1/60,input);jumpQueued=false;if(g.state==='menu')g.time+=1/60;acc-=1/60;}
  syncTrack();if(g.state!==previousState)sync();(g.levelNumber===2?baseRenderer:renderer).draw(g,dt);if(frame++%3===0)hud();requestAnimationFrame(loop);
}
sync();requestAnimationFrame(loop);
})();
