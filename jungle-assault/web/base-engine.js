(function(root){
'use strict';
const Parent=root.GameModel||(typeof require==='function'?require('./engine.js').GameModel:null);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function entry(x,y,nx,ny,r){
  let lo=0,hi=1;
  for(const [p,d,a,b] of [[x,nx-x,r.x,r.x+r.w],[y,ny-y,r.y,r.y+r.h]]){
    if(Math.abs(d)<1e-9){if(p<a||p>b)return Infinity;}
    else{let u=(a-p)/d,v=(b-p)/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)return Infinity;}
  }
  return lo;
}
const box=t=>({x:t.x-t.w/2,y:t.y-t.h/2,w:t.w,h:t.h});
// All positions are already projected into the shared 960 x 540 game canvas.
// The player stays at the front plane; shots travel toward the far wall.
class BaseLevelModel extends Parent{
  constructor(sound=()=>{},carry={}){super(sound);this.reset(carry.mode||'classic',carry);}
  reset(mode=this.mode||'classic',carry={}){
    super.reset(mode);
    for(const key of ['score','elapsed','kills','deaths','best','shots','hits'])if(Number.isFinite(carry[key]))this[key]=carry[key];
    this.lives=Number.isFinite(carry.lives)?carry.lives:mode==='practice'?8:3;
    this.nextLife=Number.isFinite(carry.nextLife)?carry.nextLife:(Math.floor(this.score/20000)+1)*20000;
    Object.assign(this.player,{x:480,y:430,face:1,aimX:0,aimY:-1,invuln:2.2,weapon:carry.weapon||'R',rapid:carry.rapid||0,jumpHeight:0,jumpVelocity:0});
    this.levelNumber=2;this.roomCount=5;this.enemyBulletLimit=4;this.cam=0;
    this.level={width:960,platforms:[],water:[]};this.capsules=[];this.bossDefeat=0;
    this.loadRoom(0);this.state='playing';return this;
  }
  loadRoom(index){
    this.roomIndex=clamp(index,0,5);this.checkpoint=this.roomIndex;this.stage=this.roomIndex;
    this.baseMode=index<5?'corridor':'boss';this.phase='combat';this.advanceProgress=0;this.barrierActive=index<5;
    this.stun=0;this.roomTime=0;this.enemyFireDelay=1.5;this.mineCooldown=1.8;this.supplySpawned=false;
    this.bullets=[];this.pickups=[];this.enemies=[];this.targets=[];
    const add=(id,x,y,hp,type='core',w=42,h=42)=>this.targets.push({id,x,y,w,h,hp,maxHp:hp,type,open:true,flash:0,charge:0,cooldown:2.4+this.targets.length*.55});
    if(index===0)add('room-1-core',480,235,6);
    if(index===1){add('room-2-core',390,235,7);add('room-2-gun',570,175,4,'turret',48,42);}
    if(index===2){add('room-3-core',540,268,8,'core',46,38);add('room-3-gun',420,150,4,'turret',48,42);}
    if(index===3){add('room-4-core',480,225,9);add('room-4-launcher',350,272,4,'turret',48,34);}
    if(index===4){add('room-5-left',430,205,6);add('room-5-right',530,205,6);add('room-5-heavy',480,268,8,'core',54,42);add('room-5-gun',610,165,4,'turret',48,42);}
    this.boss={active:index===5,phase:index===5?1:0,x:480,y:170,hp:0,maxHp:1,time:0,flash:0,cooldown:2.8,nextPort:0,defeat:0};
    if(index===5){
      add('boss-left-port',330,180,6,'turret',58,48);add('boss-right-port',630,180,6,'turret',58,48);
      for(const [i,x,y] of [[0,420,145],[1,540,145],[2,420,252],[3,540,252]])add('boss-sensor-'+i,x,y,4,'core',38,38);
      this.boss.hp=this.boss.maxHp=28;this.notify('基地指挥室 · 摧毁两侧炮口与四枚红色传感器',4);this.sound('boss');
    }else{
      this.enemies.push({id:'guard-'+index,type:'guard',x:index%2?610:350,y:284,w:24,h:34,hp:1,maxHp:1,flash:0,active:true,age:0,dir:index%2?-1:1,cooldown:2.8});
      this.notify(['基地入口 · 红色核心控制前方电网','侧翼火力 · 对齐左侧核心射击','低位弱点 · 蹲下也能向深处射击','滚雷通道 · 跳跃越过地面的滚雷','最后防线 · 摧毁全部三个红色核心'][index],4);
    }
    return this;
  }
  playerRect(){const p=this.player,h=p.jumpHeight||0;return p.prone?{x:p.x-18,y:416,w:36,h:12}:{x:p.x-12,y:390-h,w:24,h:38};}
  fire(){
    const p=this.player;if(p.dead||p.cooldown>0||this.stun>0||this.phase!=='combat'||this.bossDefeat>0)return;
    const offsets=p.weapon==='S'?[-.16,-.08,0,.08,.16]:[0],speed=p.weapon==='L'?920:640;
    for(const a of offsets)this.bullets.push({x:p.x,y:(p.prone?414:402)-p.jumpHeight,vx:Math.sin(a)*speed,vy:-Math.cos(a)*speed,enemy:false,type:p.weapon,life:1.1,damage:p.weapon==='L'?3:1,pierce:p.weapon==='L'?3:0,depth:0,hitTargets:new Set()});
    p.cooldown=(p.weapon==='M'?.1:p.weapon==='S'?.23:p.weapon==='L'?.25:.18)*(p.rapid>0?.66:1);p.fireFlash=.08;this.shots+=offsets.length;
    this.sound(p.weapon==='S'?'spread':p.weapon==='L'?'laser':'shoot');
  }
  spawnHostile(source,kind='high',options={}){
    if(this.player.dead||this.phase!=='combat'||this.bossDefeat>0||this.enemyBulletCount()>=this.enemyBulletLimit||(!options.batch&&this.enemyFireDelay>0))return false;
    const x=source.x,y=source.y,tx=options.targetX??this.player.x,ty=kind==='mine'?432:403;
    const speed=kind==='mine'?105:options.ring?120:130,a=Math.atan2(ty-y,tx-x);
    this.bullets.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,enemy:true,destructible:true,type:kind==='mine'?'mine':options.ring?'ring':'orb',kind,ring:!!options.ring,life:4.5,damage:1,depth:1});
    this.enemyFireDelay=.65;return true;
  }
  update(dt,input={}){
    if(this.state!=='playing')return;dt=clamp(dt,0,.04);this.time+=dt;this.elapsed+=dt;this.roomTime+=dt;
    this.noticeTime=Math.max(0,this.noticeTime-dt);this.shake=Math.max(0,this.shake-dt*24);this.enemyFireDelay=Math.max(0,this.enemyFireDelay-dt);
    const p=this.player;p.invuln=Math.max(0,p.invuln-dt);p.fireFlash=Math.max(0,p.fireFlash-dt);p.cooldown=Math.max(0,p.cooldown-dt);p.rapid=Math.max(0,p.rapid-dt);this.stun=Math.max(0,this.stun-dt);
    if(this.bossDefeat>0){
      this.bossDefeat=Math.max(0,this.bossDefeat-dt);this.boss.defeat=this.bossDefeat;
      if(this.random()<.3)this.burst(400+this.random()*160,120+this.random()*140,'#ffb770',5);
      if(this.bossDefeat===0){this.score+=10000;this.best=Math.max(this.best,this.score);this.state='victory';this.sound('clear');}
      this.updateParticles(dt);return;
    }
    if(p.dead){p.dead-=dt;if(p.dead<=0){if(this.lives<=0){this.state='gameover';this.best=Math.max(this.best,this.score);}else this.respawn();}}
    else{
      const ix=clamp(input.x||0,-1,1),iy=clamp(input.y||0,-1,1);
      if(iy<-.4&&this.barrierActive&&this.stun<=0){this.stun=.8;this.shake=3;this.notify('电网仍在通电 · 先摧毁全部红色核心',1.5);this.sound('hit');}
      p.prone=iy>.4&&p.jumpHeight===0&&this.stun===0;p.vx=this.stun>0||p.prone?0:ix*230;
      p.x=clamp(p.x+p.vx*dt,120,840);p.y=430;p.aimX=0;p.aimY=-1;
      if(this.stun===0&&input.jump&&p.jumpHeight===0){p.jumpVelocity=310;p.ground=false;this.sound('jump');}
      if(p.jumpHeight>0||p.jumpVelocity>0){p.jumpHeight=Math.max(0,p.jumpHeight+p.jumpVelocity*dt);p.jumpVelocity-=850*dt;if(p.jumpHeight===0){p.jumpVelocity=0;p.ground=true;}}
      if(this.phase==='advance'||this.phase==='transition'){
        if(iy<-.4){this.phase='transition';this.advanceProgress=Math.min(1,this.advanceProgress+dt);if(this.advanceProgress>=1-1e-8){this.loadRoom(this.roomIndex+1);p.x=480;p.jumpHeight=0;p.jumpVelocity=0;p.ground=true;p.prone=false;p.invuln=Math.max(p.invuln,1.2);}}
        else this.phase='advance';
      }else if(input.fire)this.fire();
    }
    if(this.state!=='playing'){this.updateParticles(dt);return;}
    this.updateActors(dt);this.updateBullets(dt);this.updatePickups(dt);this.checkRoom();
    if(this.score>=this.nextLife){this.lives++;this.nextLife+=20000;this.notify('奖励生命 +1');this.sound('pickup');}
    this.updateParticles(dt);
  }
  updateActors(dt){
    for(const target of this.targets){target.flash=Math.max(0,target.flash-dt);target.charge=0;}
    if(this.boss.active){this.updateBaseBoss(dt);return;}
    if(this.phase!=='combat')return;
    if(!this.supplySpawned&&this.roomTime>=1.4){
      this.supplySpawned=true;this.enemies.push({id:'supply-'+this.roomIndex,type:'supply',x:300,y:288,w:26,h:36,hp:1,maxHp:1,flash:0,active:true,age:0,dir:1,drop:['M','S','R','M','S'][this.roomIndex]});
    }
    for(const e of this.enemies){
      if(e.hp<=0)continue;e.flash=Math.max(0,e.flash-dt);e.age+=dt;e.x+=e.dir*(e.type==='supply'?44:14)*dt;
      if(e.x>675)e.dir=-1;if(e.x<285)e.dir=1;
      if(e.type!=='supply'){e.cooldown-=dt;if(e.cooldown<=0)e.cooldown=this.spawnHostile(e)?3.4:.3;}
    }
    for(const t of this.targets){
      if(t.type!=='turret'||t.hp<=0)continue;t.cooldown-=dt;t.charge=clamp((.6-t.cooldown)/.6,0,1);
      if(t.cooldown<=0)t.cooldown=this.spawnHostile(t,this.roomIndex===3?'mine':'high')?3.5:.3;
    }
    if(this.roomIndex===3){this.mineCooldown-=dt;if(this.mineCooldown<=0)this.mineCooldown=this.spawnHostile({x:this.player.x,y:315},'mine')?3.2:.35;}
    this.enemies=this.enemies.filter(e=>e.hp>0);
  }
  updateBaseBoss(dt){
    const b=this.boss;b.time+=dt;b.flash=Math.max(0,b.flash-dt);if(this.player.dead)return;
    if(b.phase===1){
      const ports=this.targets.filter(t=>t.type==='turret');
      ports.forEach((t,i)=>{t.open=(this.roomTime+i*.55)%3.6<2.7;});
      b.cooldown-=dt;
      let index=b.nextPort;if(ports[index].hp<=0)index=1-index;
      const port=ports[index];if(port.hp<=0)return;
      port.charge=port.open?clamp((.7-b.cooldown)/.7,0,1):0;
      if(b.cooldown<=0&&port.open){if(this.spawnHostile(port)){b.cooldown=1.9;b.nextPort=1-index;}else b.cooldown=.25;}
    }else{
      b.cooldown-=dt;
      if(b.cooldown<=0&&this.enemyFireDelay<=0){
        for(let i=0;i<3;i++){const a=this.roomTime*2+i*Math.PI*2/3;this.spawnHostile({x:b.x+Math.cos(a)*18,y:190+Math.sin(a)*18},'high',{ring:true,batch:true,targetX:this.player.x+(i-1)*55});}
        b.cooldown=3.2;
      }
    }
  }
  updateBullets(dt){
    const paths=[];
    for(const b of this.bullets){b.life-=dt;if(b.life<=0)continue;const ox=b.x,oy=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.depth=clamp((430-b.y)/290,0,1);paths.push({b,ox,oy,nx:b.x,ny:b.y});}
    const playerShots=paths.filter(v=>!v.b.enemy),hostiles=paths.filter(v=>v.b.enemy),events=[];
    for(const shot of playerShots)for(const hostile of hostiles){const radius=hostile.b.kind==='mine'?11:8;const t=entry(shot.ox-hostile.ox,shot.oy-hostile.oy,shot.nx-hostile.nx,shot.ny-hostile.ny,{x:-radius,y:-radius,w:radius*2,h:radius*2});if(t!==Infinity)events.push({shot,hostile,t});}
    events.sort((a,b)=>a.t-b.t);
    for(const {shot,hostile,t} of events){if(shot.b.life<=0||hostile.b.life<=0)continue;hostile.b.life=0;this.burst(hostile.ox+(hostile.nx-hostile.ox)*t,hostile.oy+(hostile.ny-hostile.oy)*t,'#ffdc90',5);if(shot.b.pierce>0)shot.b.pierce--;else shot.b.life=0;this.sound('hit');}
    for(const path of paths){
      const {b,ox,oy}=path;if(b.life<=0)continue;
      if(b.enemy){
        if(!this.player.dead){
          if(b.kind==='mine'||b.type==='mine'){
            if(this.player.jumpHeight<24&&entry(ox,oy,b.x,b.y,{x:this.player.x-20,y:411,w:40,h:30})!==Infinity){if(this.damage())b.life=0;}
          }else if(!this.player.prone&&b.y>=380&&entry(ox,Math.max(oy,380),b.x,Math.min(b.y,405),this.playerRect())!==Infinity){if(this.damage())b.life=0;}
        }
        if(b.y>(b.kind==='mine'||b.type==='mine'?451:405))b.life=0;
      }else{
        const collisions=[];if(!b.hitTargets)b.hitTargets=new Set();
        for(const target of [...this.targets,...this.enemies]){if(target.hp<=0||b.hitTargets.has(target.id))continue;const t=entry(ox,oy,b.x,b.y,box(target));if(t!==Infinity)collisions.push({target,t});}
        collisions.sort((a,c)=>a.t-c.t);
        for(const {target} of collisions){
          if(b.life<=0)break;b.hitTargets.add(target.id);
          if(target.open===false){this.burst(b.x,b.y,'#a9b5ad',3);b.life=0;break;}
          target.hp=Math.max(0,target.hp-b.damage);target.flash=.12;this.hits++;this.burst(target.x,target.y,'#ff976e',3);
          if(target.hp===0){this.score+=target.type==='core'?500:target.type==='supply'?300:200;this.kills++;this.burst(target.x,target.y,'#ffb968',18);this.sound('explosion');this.shake=3;if(target.type==='supply')this.pickups.push({x:target.x,y:target.y,type:target.drop||'M',t:0,homing:true});}
          if(b.pierce>0)b.pierce--;else b.life=0;
        }
      }
      if(b.x<60||b.x>900||b.y<70||b.y>550)b.life=0;
    }
    this.bullets=this.bullets.filter(b=>b.life>0);this.enemies=this.enemies.filter(e=>e.hp>0);
  }
  updatePickups(dt){
    const p=this.player;
    for(const item of this.pickups){item.t+=dt;const dx=p.x-item.x,dy=407-item.y,distance=Math.hypot(dx,dy),step=Math.min(distance,260*dt);if(distance>0){item.x+=dx/distance*step;item.y+=dy/distance*step;}
      if(!p.dead&&Math.hypot(p.x-item.x,407-item.y)<23){if(item.type==='R'){p.rapid=20;this.notify('R · 高速射击');}else if(item.type==='B'){p.invuln=9;this.notify('B · 无敌屏障');}else{p.weapon=item.type;this.notify(item.type+' · 补给武器已拾取');}item.collected=true;this.score+=200;this.sound('pickup');}
    }
    this.pickups=this.pickups.filter(item=>!item.collected&&item.t<12);
  }
  checkRoom(){
    if(this.boss.active){
      this.boss.hp=this.targets.reduce((sum,t)=>sum+Math.max(0,t.hp),0);
      if(this.boss.hp>0||this.bossDefeat>0)return;
      this.bullets=[];
      if(this.boss.phase===1){this.boss.phase=2;this.boss.hp=this.boss.maxHp=24;this.boss.cooldown=2.2;this.boss.flash=.3;this.enemyFireDelay=1.5;this.targets=[{id:'boss-eye',x:480,y:190,w:100,h:72,hp:24,maxHp:24,type:'core',open:true,flash:0,charge:0}];this.notify('眼形机核已显现 · 射击中央眼睛，俯卧躲避火环',4);this.sound('boss');}
      else{this.bossDefeat=2.4;this.boss.defeat=2.4;this.notify('基地核心摧毁 · 第二关完成',4);this.sound('explosion');this.shake=10;}
    }else if(this.phase==='combat'&&this.targets.filter(t=>t.type==='core').every(t=>t.hp<=0)){
      this.barrierActive=false;this.stun=0;this.phase='advance';this.bullets=this.bullets.filter(b=>!b.enemy);this.enemies=[];this.notify('电网已关闭 · 按住上方向前进入下一室',4);this.sound('pickup');
    }
  }
  respawn(){
    const p=this.player;Object.assign(p,{x:480,y:430,vx:0,vy:0,dead:0,prone:false,ground:true,water:false,jumpHeight:0,jumpVelocity:0,weapon:'R',rapid:0,invuln:3,cooldown:.2});
    this.stun=0;this.bullets=[];this.enemyFireDelay=2;this.mineCooldown=Math.max(this.mineCooldown,2);if(this.boss.active)this.boss.cooldown=3;this.notify('重新投入战斗 · 当前房间进度保留');
  }
  continueGame(){this.lives=this.mode==='practice'?8:3;this.score=Math.max(0,this.score-2000);this.state='playing';this.respawn();}
  hud(){return {title:this.boss.active?'02 / 基地指挥室':'02 / 基地房间 '+(this.roomIndex+1)+' / '+this.roomCount,progress:(this.roomIndex+(this.phase==='combat'?0:this.advanceProgress))/6*100,coresRemaining:this.targets.filter(t=>t.type==='core'&&t.hp>0).length,barrierActive:this.barrierActive,stun:this.stun,bossPhase:this.boss.phase};}
  summary(){return {levelNumber:2,roomsCleared:Math.min(this.roomIndex,5),score:this.score,lives:this.lives,kills:this.kills,deaths:this.deaths,elapsed:this.elapsed,shots:this.shots,hits:this.hits,weapon:this.player.weapon};}
}
root.BaseLevelModel=BaseLevelModel;if(typeof module!=='undefined')module.exports={BaseLevelModel};
})(typeof window!=='undefined'?window:globalThis);
