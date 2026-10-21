(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function segmentRect(x,y,nx,ny,r){
  let lo=0,hi=1;
  for(const [p,d,a,b] of [[x,nx-x,r.x,r.x+r.w],[y,ny-y,r.y,r.y+r.h]]){
    if(Math.abs(d)<1e-8){if(p<a||p>b)return false;}
    else{let u=(a-p)/d,v=(b-p)/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)return false;}
  }return true;
}
class GameModel{
  constructor(sound=()=>{}){this.sound=sound;this.best=0;this.mode='classic';this.reset();this.state='menu';}
  random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
  reset(mode=this.mode){
    this.mode=mode;this.seed=7136;this.time=0;this.elapsed=0;this.cam=0;this.shake=0;this.score=0;this.kills=0;this.shots=0;this.hits=0;this.deaths=0;this.nextLife=20000;this.lives=mode==='practice'?8:3;this.checkpoint=96;this.stage=0;this.notice='行动开始 · 向右突破';this.noticeTime=3;this.bossDefeat=0;
    this.player={x:96,y:430,w:22,h:42,face:1,vx:0,vy:0,ground:true,prone:false,aimX:1,aimY:0,invuln:1.5,dead:0,fireFlash:0,weapon:'R',water:false,cooldown:0,coyote:0.1,jumpBuffer:0,drop:0,rapid:0};
    const ground=[[0,1080,430],[1790,650,430],[2440,580,390],[3540,860,430],[4400,400,390],[4800,440,430],[5370,990,430],[6360,680,390],[7040,1560,430]];
    this.level={width:8600,scenerySeed:7,platforms:ground.map(([x,w,y])=>({x,w,y,h:540-y,type:'ground',broken:false,crumble:null})),water:[{x:1080,w:710},{x:3020,w:520},{x:5240,w:130}]};
    for(let x=1080;x<1790;x+=90)this.level.platforms.push({x,w:90,y:430,h:14,type:'bridge',broken:false,crumble:null});
    for(let x=3020;x<3540;x+=86)this.level.platforms.push({x,w:86,y:390,h:14,type:'bridge',broken:false,crumble:null});
    for(const [x,y,w] of [[370,342,210],[750,310,170],[1910,335,200],[2220,286,140],[2700,294,170],[3750,330,180],[4070,270,170],[4580,290,150],[5600,334,190],[5960,280,180],[6550,290,190],[7240,342,190],[7650,340,190],[7950,366,160]])this.level.platforms.push({x,y,w,h:16,type:'ledge',broken:false,crumble:null});
    this.enemies=[];
    const add=(x,y,type)=>this.enemies.push({x,y,w:type==='turret'?34:22,h:type==='turret'?28:40,type,face:-1,hp:type==='turret'?8:type==='grenadier'?3:1,flash:0,anim:0,active:false,vy:0,cooldown:1.2+this.random(),ground:false,spawnX:x,dead:false});
    for(const [x,y] of [[690,430],[1060,430],[1480,430],[2020,430],[2510,390],[2910,390],[3370,390],[3900,430],[4230,430],[4660,390],[5090,430],[5510,430],[5890,430],[6230,430],[6790,390],[7130,430],[7520,430]])add(x,y,'runner');
    for(const [x,y] of [[870,310],[1980,335],[2320,286],[2780,294],[3820,330],[4140,270],[4660,290],[5680,334],[6050,280],[6660,290],[7330,342]])add(x,y,'rifle');
    for(const [x,y] of [[990,430],[2380,430],[3620,430],[4930,430],[6160,430],[7000,390],[7770,430]])add(x,y,'turret');
    for(const [x,y] of [[2860,390],[4360,430],[5810,430],[6920,390],[7580,430]])add(x,y,'grenadier');
    this.bullets=[];this.pickups=[{x:475,y:418,type:'M',t:0,vy:0}];this.capsules=[];
    for(const [x,y,type] of [[780,245,'S'],[2160,230,'M'],[3300,230,'B'],[4030,210,'S'],[5540,250,'L'],[6520,210,'S'],[7440,250,'B']])this.capsules.push({x,y,baseY:y,hp:2,type,t:0});
    this.particles=[];this.boss={x:8260,y:430,hp:60,maxHp:60,active:false,phase:0,coreOpen:false,flash:0,time:0,cooldown:1,turrets:[{x:8210,y:280,hp:14,flash:0,cooldown:1},{x:8320,y:382,hp:14,flash:0,cooldown:1.8}]};
    this.state='playing';return this;
  }
  notify(s,t=2.5){this.notice=s;this.noticeTime=t;}
  burst(x,y,color='#ffba63',n=14){for(let i=0;i<n;i++){const a=this.random()*Math.PI*2,s=35+this.random()*135,l=.25+this.random()*.55;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-30,size:2+this.random()*5,color,life:l,maxLife:l});}}
  playerRect(){const p=this.player;return p.prone?{x:p.x-18,y:p.y-14,w:36,h:12}:p.water?{x:p.x-9,y:p.y-23,w:18,h:21}:{x:p.x-9,y:p.y-38,w:18,h:36};}
  surface(x,oldY,newY,drop=false){let out=null;for(const a of this.level.platforms){if(a.broken||x<a.x-5||x>a.x+a.w+5||(drop&&a.type!=='ground'))continue;if(oldY<=a.y+3&&newY>=a.y){if(!out||a.y<out.y)out=a;}}return out;}
  fire(){
    const p=this.player;if(p.cooldown>0||p.dead)return;
    const speed=p.weapon==='L'?1050:650;let angle=Math.atan2(p.aimY,p.aimX),angles=p.weapon==='S'?[-.23,-.115,0,.115,.23]:[0];
    let sx=p.x+p.aimX*20,sy=p.y-(p.prone?9:p.water?19:27)+p.aimY*15;
    for(const a of angles)this.bullets.push({x:sx,y:sy,vx:Math.cos(angle+a)*speed,vy:Math.sin(angle+a)*speed,enemy:false,type:p.weapon,life:p.weapon==='L'?.72:1.2,damage:p.weapon==='L'?3:1,pierce:p.weapon==='L'?3:0});
    p.cooldown=(p.weapon==='M'?.085:p.weapon==='S'?.21:p.weapon==='L'?.24:.16)*(p.rapid>0?.66:1);p.fireFlash=.07;this.shots+=angles.length;this.sound(p.weapon==='S'?'spread':p.weapon==='L'?'laser':'shoot');
  }
  enemyFire(e,grenade=false){
    const p=this.player,x=e.x+(e.face||-1)*15,y=e.y-(e.type==='turret'?15:27);let angle=Math.atan2(p.y-24-y,p.x-x);const speed=grenade?180:e.type==='turret'?160:145;
    this.bullets.push({x,y,vx:Math.cos(angle)*speed,vy:grenade?-245:Math.sin(angle)*speed,enemy:true,type:grenade?'grenade':'orb',life:grenade?2.2:5,damage:1});
  }
  killEnemy(e){e.dead=true;this.kills++;this.score+=e.type==='turret'?500:e.type==='grenadier'?300:100;this.burst(e.x,e.y-e.h/2,e.type==='turret'?'#ffaf58':'#ff8a63');this.sound(e.type==='turret'?'explosion':'hit');this.shake=e.type==='turret'?4:1.5;}
  damage(){
    const p=this.player;if(p.invuln>0||p.dead||this.state!=='playing'||this.bossDefeat>0)return false;
    p.dead=.9;p.vx=0;this.deaths++;this.lives--;this.burst(p.x,p.y-22,'#70d5ed',26);this.shake=8;this.sound('death');return true;
  }
  respawn(){const p=this.player;p.x=this.checkpoint;p.y=this.checkpoint===96?430:260;p.vy=0;p.vx=0;p.invuln=3;p.dead=0;p.weapon='R';p.rapid=0;p.ground=this.checkpoint===96;p.water=false;p.prone=false;p.cooldown=.2;this.cam=clamp(p.x-150,0,this.level.width-960);this.bullets=this.bullets.filter(b=>!b.enemy);this.notify('重新投入战斗 · 短暂无敌');}
  continueGame(){this.lives=this.mode==='practice'?8:3;this.score=Math.max(0,this.score-2000);this.state='playing';this.respawn();}
  update(dt,input={}){
    if(this.state!=='playing')return;dt=clamp(dt,0,.04);this.time+=dt;this.elapsed+=dt;this.noticeTime=Math.max(0,this.noticeTime-dt);this.shake=Math.max(0,this.shake-dt*24);
    const p=this.player;p.invuln=Math.max(0,p.invuln-dt);p.fireFlash=Math.max(0,p.fireFlash-dt);p.cooldown=Math.max(0,p.cooldown-dt);p.drop=Math.max(0,p.drop-dt);p.rapid=Math.max(0,p.rapid-dt);
    if(this.bossDefeat>0){this.bossDefeat-=dt;if(this.random()<.4)this.burst(this.boss.x+(this.random()-.5)*190,180+this.random()*250,'#ffbd6d',4);if(this.bossDefeat<=0){this.score+=5000;this.best=Math.max(this.score,this.best);this.state='victory';this.sound('clear');}this.updateParticles(dt);return;}
    if(p.dead){p.dead-=dt;if(p.dead<=0){if(this.lives<=0){this.state='gameover';this.best=Math.max(this.score,this.best);}else this.respawn();}}
    else{
      const ix=clamp(input.x||0,-1,1),iy=clamp(input.y||0,-1,1);
      p.prone=iy>.4&&p.ground&&!p.water;
      if(ix)p.face=ix<0?-1:1;
      p.aimX=ix?Math.sign(ix):(iy<-.4||(iy>.4&&!p.ground))?0:p.face;p.aimY=iy<-.4?-1:iy>.4&&!p.ground?1:0;
      if(p.aimY&&p.aimX){p.aimX*=Math.SQRT1_2;p.aimY*=Math.SQRT1_2;}
      p.jumpBuffer=input.jump?.12:Math.max(0,p.jumpBuffer-dt);p.coyote=p.ground?.1:Math.max(0,p.coyote-dt);
      if(p.jumpBuffer>0&&p.coyote>0){
        const under=this.level.platforms.find(a=>!a.broken&&p.x>=a.x&&p.x<=a.x+a.w&&Math.abs(p.y-a.y)<4);
        if(iy>.4&&under&&under.type!=='ground'){p.drop=.25;p.y+=5;p.vy=45;p.ground=false;}
        else{p.vy=p.water?-455:-510;p.ground=false;p.water=false;this.sound('jump');}
        p.jumpBuffer=0;p.coyote=0;
      }
      p.vx=p.prone?0:ix*(p.water?112:192);const oldX=p.x;p.x=clamp(p.x+p.vx*dt,this.cam+13,this.level.width-175);
      for(const a of this.level.platforms){if(a.type!=='ground'||p.y<=a.y+3)continue;
        if(p.vx>0&&oldX+10<=a.x+.1&&p.x+10>a.x)p.x=a.x-10;
        if(p.vx<0&&oldX-10>=a.x+a.w-.1&&p.x-10<a.x+a.w)p.x=a.x+a.w+10;
      }
      if(this.boss.active&&this.boss.hp>0)p.x=Math.min(p.x,this.boss.x-130);
      const oldY=p.y;p.vy+=1150*dt;p.y+=p.vy*dt;p.ground=false;p.water=false;
      if(p.vy>=0){const floor=this.surface(p.x,oldY,p.y,p.drop>0);if(floor){p.y=floor.y;p.vy=0;p.ground=true;if(floor.type==='bridge'&&floor.crumble===null){floor.crumble=.65;this.sound('hit');}}
        else if(this.level.water.some(w=>p.x>w.x&&p.x<w.x+w.w)&&p.y>=478){p.y=478;p.vy=0;p.ground=true;p.water=true;p.prone=false;}}
      if(p.y>590)this.damage();
      if(input.fire)this.fire();
      this.cam=Math.max(this.cam,clamp(p.x-310,0,this.level.width-960));
      const cps=[2000,4300,6300,7740];for(const cp of cps)if(p.x>cp+120&&this.checkpoint<cp){this.checkpoint=cp;this.notify('检查点已保存');}
      const stages=[1100,3020,5400,7800];const titles=['爆破木桥 · 可落水前进','深入丛林 · 留意高处枪手','火力封锁 · 突破炮台阵地','警报 · 摧毁双炮口，攻击开启的核心'];
      for(let i=0;i<stages.length;i++)if(p.x>=stages[i]&&this.stage<i+1){this.stage=i+1;this.notify(titles[i],3);}
    }
    for(const a of this.level.platforms){if(a.crumble!==null&&!a.broken){a.crumble-=dt;if(a.crumble<=0){a.broken=true;this.burst(a.x+a.w/2,a.y,'#cda56e',9);this.shake=Math.max(this.shake,2);this.sound('explosion');}}}
    for(const e of this.enemies){
      if(e.dead)continue;e.flash=Math.max(0,e.flash-dt);e.active=e.x>this.cam-70&&e.x<this.cam+930;if(!e.active)continue;e.anim+=dt;e.face=p.x<e.x?-1:1;e.cooldown-=dt;
      if(e.type==='runner'){
        e.x+=e.face*57*dt;const oy=e.y;e.vy+=1150*dt;e.y+=e.vy*dt;const floor=this.surface(e.x,oy,e.y);if(floor){e.y=floor.y;e.vy=0;}if(e.y>550){e.dead=true;continue;}
        if(e.cooldown<=0&&Math.abs(e.x-p.x)>95){this.enemyFire(e);e.cooldown=2.8;}
      }else if(e.cooldown<=0&&!p.dead&&Math.abs(e.x-p.x)>45){this.enemyFire(e,e.type==='grenadier');e.cooldown=e.type==='turret'?1.65:e.type==='grenadier'?2.7:2;}
      if(!p.dead&&!p.water&&segmentRect(e.x,e.y-20,e.x,e.y-20,this.playerRect()))this.damage();
    }
    for(const c of this.capsules){if(c.hp<=0)continue;if(c.x<this.cam+1050&&c.x>this.cam-80){c.t+=dt;c.y=c.baseY+Math.sin(c.t*2.5)*23;c.x-=13*dt;}}
    for(const item of this.pickups){item.t+=dt;item.vy+=650*dt;const oy=item.y;item.y+=item.vy*dt;const floor=this.surface(item.x,oy+10,item.y+10);if(floor){item.y=floor.y-11;item.vy=0;}if(item.y>470&&this.level.water.some(w=>item.x>w.x&&item.x<w.x+w.w)){item.y=466;item.vy=0;}
      if(!p.dead&&Math.abs(item.x-p.x)<27&&Math.abs(item.y-(p.y-(p.water?16:22)))<35){if(item.type==='B'){p.invuln=9;this.notify('B · 无敌屏障 9 秒');}else if(item.type==='R'){p.rapid=20;this.notify('R · 高速射击');}else{p.weapon=item.type;this.notify({S:'S · 五向散弹',M:'M · 高速机枪',L:'L · 穿透激光'}[item.type]);}this.score+=200;item.t=-999;this.sound('pickup');this.burst(item.x,item.y,'#85ffe0',10);}}
    this.pickups=this.pickups.filter(v=>v.t>-100&&v.y<600);
    this.updateBoss(dt);
    for(const b of this.bullets){
      b.life-=dt;if(b.life<=0)continue;const ox=b.x,oy=b.y;if(b.type==='grenade')b.vy+=480*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(b.enemy){
        if(b.type==='grenade'&&(b.life<.08||this.surface(b.x,oy,b.y))){b.life=0;this.burst(b.x,b.y,'#ff994e',9);for(let i=0;i<6;i++){let a=i*Math.PI/3;this.bullets.push({x:b.x,y:b.y,vx:Math.cos(a)*130,vy:Math.sin(a)*130,enemy:true,type:'orb',life:1.3});}this.sound('explosion');continue;}
        if(!p.dead&&segmentRect(ox,oy,b.x,b.y,this.playerRect())){if(this.damage())b.life=0;}
      }else{
        for(const e of this.enemies){if(e.dead||!e.active)continue;const r={x:e.x-e.w/2-2,y:e.y-e.h,w:e.w+4,h:e.h};if(segmentRect(ox,oy,b.x,b.y,r)){e.hp-=b.damage;e.flash=.09;this.hits++;if(e.hp<=0)this.killEnemy(e);if(b.pierce-->0){b.x+=Math.sign(b.vx)*24;}else b.life=0;break;}}
        if(b.life<=0)continue;
        for(const c of this.capsules){if(c.hp>0&&segmentRect(ox,oy,b.x,b.y,{x:c.x-24,y:c.y-12,w:48,h:24})){c.hp-=b.damage;b.life=0;this.burst(c.x,c.y,'#ffdc85',7);if(c.hp<=0){this.pickups.push({x:c.x,y:c.y,type:c.type,t:0,vy:-80});this.score+=100;this.sound('pickup');}break;}}
        if(b.life>0&&this.boss.active&&this.boss.hp>0){let hit=false;for(const t of this.boss.turrets){if(t.hp>0&&segmentRect(ox,oy,b.x,b.y,{x:t.x-21,y:t.y-18,w:42,h:36})){t.hp-=b.damage;t.flash=.09;hit=true;if(t.hp<=0){this.score+=1500;this.burst(t.x,t.y,'#ffbd67',30);this.sound('explosion');this.shake=6;}break;}}
          if(!hit&&segmentRect(ox,oy,b.x,b.y,{x:this.boss.x-27,y:this.boss.y-120,w:54,h:56})){hit=true;if(this.boss.coreOpen){this.boss.hp-=b.damage;this.boss.flash=.08;this.hits++;this.burst(b.x,b.y,'#ff7476',2);if(this.boss.hp<=0){this.boss.hp=0;this.bossDefeat=2.8;this.bullets=this.bullets.filter(v=>!v.enemy);this.shake=12;this.sound('explosion');this.notify('核心已摧毁 · 任务完成',4);}}else this.burst(b.x,b.y,'#b6c1bb',3);}
          if(hit)b.life=0;
        }
      }
      if(b.x<this.cam-120||b.x>this.cam+1120||b.y<-100||b.y>650)b.life=0;
    }
    this.enemies=this.enemies.filter(e=>!e.dead);this.bullets=this.bullets.filter(b=>b.life>0);
    if(this.score>=this.nextLife){this.lives++;this.nextLife+=20000;this.notify('奖励生命 +1');this.sound('pickup');}
    this.updateParticles(dt);
  }
  updateBoss(dt){
    const b=this.boss,p=this.player;if(p.x>7770&&!b.active){b.active=true;this.checkpoint=7740;this.sound('boss');}
    if(!b.active||b.hp<=0)return;b.time+=dt;b.flash=Math.max(0,b.flash-dt);b.phase=b.turrets.every(t=>t.hp<=0)?1:0;b.coreOpen=b.phase===1&&(b.time%3.4)<2.3;
    for(const t of b.turrets){t.flash=Math.max(0,t.flash-dt);if(t.hp<=0)continue;t.cooldown-=dt;if(t.cooldown<=0&&!p.dead){const a=Math.atan2(p.y-25-t.y,p.x-t.x);for(const delta of [-.15,0,.15])this.bullets.push({x:t.x,y:t.y,vx:Math.cos(a+delta)*160,vy:Math.sin(a+delta)*160,enemy:true,type:'orb',life:5});t.cooldown=2.15;}}
    if(b.phase&&b.coreOpen){b.cooldown-=dt;if(b.cooldown<=0&&!p.dead){for(let i=0;i<5;i++){const a=Math.PI-.48+i*.24;this.bullets.push({x:b.x,y:b.y-95,vx:Math.cos(a)*175,vy:Math.sin(a)*175,enemy:true,type:'orb',life:5});}b.cooldown=1.3;}}
  }
  updateParticles(dt){for(const q of this.particles){q.life-=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=240*dt;}this.particles=this.particles.filter(q=>q.life>0);}
}
root.GameModel=GameModel;if(typeof module!=='undefined')module.exports={GameModel,segmentRect};
})(typeof window!=='undefined'?window:globalThis);
