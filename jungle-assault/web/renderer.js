/* Original procedural pixel artwork. No external assets. */
(() => {
  'use strict';
  const C = {
    sky:'#102b38', sky2:'#174351', mist:'#24545b', far:'#123f44', tree:'#0a2a30',
    leaf:'#164b37', light:'#2c7550', lime:'#78b54d', moss:'#c4ce6c',
    rock:'#303d41', rockD:'#19282e', rockL:'#53605a', dirt:'#42423a',
    white:'#e8ebcb', yellow:'#f6d577', orange:'#f79745', red:'#e45b4a', cyan:'#74d5ca'
  };
  const rnd = n => { let a = Math.sin(n * 127.1 + 311.7) * 43758.5453; return a - Math.floor(a); };
  class GameRenderer {
    constructor(canvas) {
      this.canvas=canvas; this.ctx=canvas.getContext('2d', {alpha:false});
      canvas.width=960; canvas.height=540; this.ctx.imageSmoothingEnabled=false;
      this.back = document.createElement('canvas'); this.back.width=960; this.back.height=540;
    }
    rect(x,y,w,h,color) { const c=this.ctx; c.fillStyle=color; c.fillRect(Math.floor(x),Math.floor(y),Math.ceil(w),Math.ceil(h)); }
    poly(points,color) {const c=this.ctx;c.fillStyle=color;c.beginPath();points.forEach((p,i)=>i?c.lineTo(Math.round(p[0]),Math.round(p[1])):c.moveTo(Math.round(p[0]),Math.round(p[1])));c.closePath();c.fill();}
    line(x0,y0,x1,y1,color,size=2) {
      x0=Math.round(x0/2);y0=Math.round(y0/2);x1=Math.round(x1/2);y1=Math.round(y1/2);
      const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let e=dx+dy;
      for(let guard=0;guard<300;guard++){this.rect(x0*2,y0*2,size,size,color);if(x0===x1&&y0===y1)break;const ee=2*e;if(ee>=dy){e+=dy;x0+=sx;}if(ee<=dx){e+=dx;y0+=sy;}}
    }
    fern(x,y,s,color,flip=1) {
      this.line(x,y,x+flip*s*9,y-s*26,color,Math.max(2,s*2));
      for(let i=1;i<6;i++){const xx=x+flip*s*i*1.5,yy=y-s*i*4;this.poly([[xx,yy],[xx-flip*s*(13-i),yy-s*8],[xx-flip*s*(5-i*.4),yy-s*7]],color);this.poly([[xx,yy],[xx+flip*s*(15-i),yy-s*9],[xx+flip*s*5,yy-s*7]],color);}
    }
    background(g) {
      const c=this.ctx,cam=g.cam||0,t=g.time||0;
      this.rect(0,0,960,540,C.sky);
      this.rect(0,82,960,170,'#173d49');this.rect(0,176,960,120,'#21525a');this.rect(0,280,960,180,'#2a5d5c');
      // A pale, stepped sun shines through mountain mist.
      const sunx=728-cam*.025;
      this.rect(sunx+10,65,44,4,'#638878');this.rect(sunx+2,69,60,8,'#749682');this.rect(sunx-2,77,68,28,'#8fa68a');this.rect(sunx+2,105,60,8,'#749682');this.rect(sunx+10,113,44,4,'#638878');
      for(let k=-1;k<6;k++){
        const x=k*280-(cam*.10%280);
        this.poly([[x-30,270],[x+20,213],[x+40,213],[x+64,161],[x+82,161],[x+104,128],[x+118,128],[x+144,192],[x+169,192],[x+207,260],[x+290,310]],'#1b464e');
        this.poly([[x+103,145],[x+117,145],[x+143,205],[x+166,205],[x+194,252],[x+151,238]],'#23515a');
      }
      // Broken temple structures, a waterfall, and layered jungle silhouettes.
      const fall=456-((cam*.19)%1850);
      for(let q=-1;q<2;q++){
        const x=fall+q*1850;
        this.rect(x-20,218,130,20,'#1c4243');this.rect(x-9,200,24,20,'#254b48');this.rect(x+67,195,25,29,'#254b48');
        this.rect(x+28,231,34,235,'#4b827c');this.rect(x+34,231,7,235,'#71a59a');this.rect(x+51,231,5,235,'#97b9a2');
        for(let j=0;j<14;j++)this.rect(x+31+(j%3)*8,236+((j*29+t*95)%212),4,14,'#b2ccaf');
        this.rect(x-2,450,94,7,'#60958a');this.rect(x+11,457,73,5,'#84afa0');
      }
      for(let i=-2;i<15;i++){
        const x=i*124-(cam*.24%124),seed=i+Math.floor(cam*.24/124);
        const h=130+rnd(seed+43)*90, y=440-h;
        this.rect(x+27,y,16,h,'#123e3e');this.rect(x+31,y+10,4,h-12,'#1b4944');
        this.poly([[x-30,y+41],[x-20,y+22],[x+4,y+22],[x+12,y],[x+27,y],[x+40,y-20],[x+57,y],[x+74,y+10],[x+80,y+29],[x+103,y+29],[x+110,y+47]],'#17463f');
        this.rect(x-8,y+38,78,14,'#17463f');
      }
      for(let i=-1;i<9;i++){
        const x=i*180-(cam*.43%180), seed=i+Math.floor(cam*.43/180);
        const y=125+rnd(seed+88)*65;
        this.poly([[x+58,480],[x+78,480],[x+81,y+75],[x+96,y+23],[x+88,y+13],[x+70,y+68]],'#0c3034');
        this.rect(x+68,y+80,5,238,'#17413d');
        this.poly([[x+73,y+70],[x+19,y+26],[x+15,y+34],[x+69,y+91]],'#0c3034');
        this.poly([[x-24,y+29],[x-14,y+10],[x+6,y+10],[x+19,y-13],[x+47,y-13],[x+61,y-37],[x+86,y-37],[x+101,y-21],[x+131,y-21],[x+144,y+4],[x+168,y+11],[x+176,y+31],[x+135,y+44],[x+22,y+46]],'#103934');
        this.rect(x+26,y+5,66,7,'#17433a');this.rect(x+96,y+16,46,6,'#17433a');
        this.line(x+123,y+35,x+125,y+129,'#1b4a3e',2);this.line(x+125,y+129,x+111,y+146,'#1b4a3e',2);
      }
      this.rect(0,454,960,86,'#173e46');
      for(let row=0;row<8;row++){
        const yy=460+row*11,sp=66+row*9,off=(cam*.6+t*(row%2?16:-13))%sp;
        for(let j=-1;j<15;j++){
          const xx=j*sp-off+(row%3)*21;
          this.rect(xx,yy,14+row*4,2,row%2?'#31636a':'#28565e');
          if(row<3)this.rect(xx+9,yy+4,6,2,'#49827c');
        }
      }
      // Occasional wisps and fireflies; deliberately subtle behind combat.
      for(let i=0;i<10;i++){
        const x=(rnd(i+55)*1200-cam*.18)%1020,y=150+rnd(i+2)*280+Math.sin(t*.7+i)*5;
        if(Math.sin(t+i*4)>.6){this.rect(x,y,2,2,'#94ba71');}
      }
    }
    terrain(p,cam,t) {
      if(p.broken)return;
      const x=Math.round(p.x-cam),y=p.y,w=p.w,h=p.h||30;
      if(x>980||x+w<-20)return;
      if(p.type==='bridge'){
        const warn=p.crumble!=null&&p.crumble<1.3;
        this.line(x,y-24,x+w,y-24,'#52594a',2);this.line(x,y-17,x+w,y-17,'#39483e',2);
        for(let j=0;j<w;j+=38){this.rect(x+j,y-26,4,33,'#6f7255');this.rect(x+j+1,y-26,2,24,'#a1a172');}
        for(let j=0;j<w;j+=14){const dip=warn?Math.sin(t*22+j)*2:0;this.rect(x+j,y+dip,12,7,warn?'#c29353':'#a38b5a');this.rect(x+j+2,y+1+dip,8,2,'#c0aa72');this.rect(x+j,y+7+dip,12,5,'#514a35');}
        this.rect(x,y+13,w,4,'#2c3a32');return;
      }
      const bottom=p.type==='ground'?550:y+h;
      this.rect(x,y+7,w,bottom-y-7,C.rockD);
      this.rect(x,y+10,w,Math.min(22,bottom-y),C.dirt);
      this.rect(x,y+2,w,8,'#47784a');this.rect(x,y,w,4,'#a0b86b');
      for(let j=Math.max(0,Math.floor((-x-28)/24)*24);j<Math.min(w,990-x);j+=24){const seed=Math.floor((p.x+j)/16);const xx=x+j, hh=6+rnd(seed+7)*8;this.rect(xx,y+4,14,hh,'#28543c');this.rect(xx+4,y+8,6,hh,'#1c4234');if(rnd(seed)>0.5)this.rect(xx+4,y-4,4,5,'#638e4d');}
      for(let row=0;row<Math.ceil((bottom-y)/28);row++){
        for(let j=Math.max(0,Math.floor((-x-50)/46)*46);j<Math.min(w,1010-x);j+=46){
          const xx=x+j+(row%2)*-22, yy=y+26+row*29,seed=p.x+j+row*31;
          const ww=Math.min(38+rnd(seed)*8,x+w-xx);if(ww<=0)continue;
          if(xx<x)continue;
          this.poly([[xx+5,yy],[xx+ww-6,yy],[xx+ww,yy+6],[xx+ww-4,yy+23],[xx+4,yy+25],[xx,yy+17]],rnd(seed+1)>.5?'#384447':'#2c393d');
          this.rect(xx+7,yy+2,ww-16,3,'#4b5652');this.rect(xx+3,yy+17,4,5,'#202e33');
          if(rnd(seed+90)>.6)this.rect(xx+ww-9,yy+9,4,6,'#56615a');
        }
      }
      if(p.type==='ledge'){
        this.poly([[x,y+h-2],[x+16,y+h+11],[x+w-14,y+h+9],[x+w,y+h-2]],'#1c2e30');
        for(let k=20;k<w-10;k+=37){this.line(x+k,y+h-2,x+k-5,y+h+22,'#1d4938',2);this.rect(x+k-7,y+h+8,8,4,'#3f7145');}
      } else {
        for(let j=18+Math.max(0,Math.floor((-x-100)/157))*157;j<Math.min(w,1060-x);j+=157){if(rnd(p.x+j+7)>.45)this.fern(x+j,y+1,.65,'#538551',-1);}
      }
    }
    soldier(o,cam,t,isPlayer) {
      if(o.dead>0)return;
      if(isPlayer&&o.invuln>0&&Math.floor(t*16)%2===0)return;
      const c=this.ctx,x=Math.round(o.x-cam),y=Math.round(o.y),f=o.face||1;
      const skin=o.flash>0?'#fff5d4':isPlayer?'#e5ae77':'#c3986d',light=isPlayer?'#f6c995':'#d8b083';
      const pants=isPlayer?'#376b9b':o.type==='grenadier'?'#797147':'#537747',dark=isPlayer?'#203b60':'#2b4737';
      c.save();c.translate(x,y);c.scale(f,1);
      if(o.prone){
        this.rect(-22,-9,24,7,pants);this.rect(-26,-6,9,6,dark);this.rect(-2,-13,18,10,skin);this.rect(10,-17,10,9,skin);this.rect(9,-19,12,4,isPlayer?'#d35f4c':'#537747');this.rect(19,-14,2,2,'#263236');
        this.rect(2,-6,17,4,dark);this.rect(15,-11,24,4,'#17242b');this.rect(22,-13,6,2,'#9ca496');this.rect(7,-9,15,4,light);
        if(o.fireFlash>0){this.poly([[39,-10],[47,-14],[44,-8],[51,-6],[40,-6]],'#ffe0a2');}
        c.restore();return;
      }
      const jumping=!o.ground&&!o.water&&isPlayer;
      const run=Math.abs(o.vx||0)>8;
      const phase=Math.sin(t*(isPlayer?16:12)+(o.anim||0));
      let legA=run?phase*6:0,legB=run?-phase*6:0;
      if(jumping){legA=-6;legB=5;}
      // Boots, folded trouser legs, and a light side seam.
      this.rect(-10+legA,-14,7,12,pants);this.rect(-4+legB,-15,7,12,dark);
      this.rect(-11+legA,-3,10,4,'#172b36');this.rect(-4+legB,-3,10,4,'#172b36');
      this.rect(-9+legA,-13,2,9,isPlayer?'#5995bc':'#7b9454');
      this.rect(-9,-27,17,15,pants);this.rect(-9,-16,18,4,'#182d35');this.rect(2,-16,3,3,'#bec08c');
      this.rect(-8,-35,14,13,skin);this.rect(-7,-34,5,8,light);
      if(!isPlayer){this.rect(-9,-32,15,14,pants);this.rect(-8,-26,15,2,'#8e9a5b');this.rect(-5,-31,3,7,'#293b30');}
      else{this.rect(-8,-33,3,13,'#bd7756');this.rect(-5,-30,9,3,light);}
      this.rect(-5,-44,10,11,skin);this.rect(-6,-44,11,4,isPlayer?'#3b3934':'#354e3a');
      if(isPlayer){this.rect(-6,-41,12,3,'#d85c4b');this.rect(-12,-40,7,2,'#b5413e');this.rect(-15,-38,7,2,'#c44d42');}
      else{this.rect(-8,-46,14,6,pants);this.rect(-8,-41,17,2,'#778e56');}
      this.rect(4,-39,2,2,'#273130');this.rect(5,-35,3,2,skin);
      // Eight direction gun and the supporting hand stay readable while jumping.
      let dx=(o.aimX==null?f:o.aimX)*f,dy=o.aimY||0;
      if(Math.abs(dx)+Math.abs(dy)<.1)dx=1;
      const n=Math.hypot(dx,dy);dx/=n;dy/=n;
      const gx=2,gy=-28;
      this.line(gx,gy,gx+dx*22,gy+dy*22,'#15252b',6);
      this.line(gx+dx*14,gy+dy*14,gx+dx*25,gy+dy*25,'#a2aaa0',2);
      this.line(-5,-31,gx+dx*10,gy+dy*10,skin,5);this.line(gx+dx*8,gy+dy*8,gx+dx*15,gy+dy*15,light,4);
      this.rect(-6,-31,4,5,light);
      if(o.fireFlash>0){const ex=gx+dx*28,ey=gy+dy*28;this.rect(ex-3,ey-3,7,7,'#fff4c4');this.rect(ex+dx*5-2,ey+dy*5-2,4,4,'#f5b45e');}
      c.restore();
      if(o.water){this.rect(x-22,y-10,44,3,'#9ac1a6');this.rect(x-17,y-6,34,2,'#4d8b83');}
    }
    turret(o,cam,t,big=false) {
      const x=Math.round(o.x-cam),y=Math.round(o.y),c=this.ctx;
      c.save();c.translate(x,y);
      this.rect(-20,-12,40,14,'#1d2c31');this.rect(-23,-6,46,6,'#657369');
      this.poly([[-18,-12],[-18,-29],[-10,-37],[11,-37],[19,-29],[19,-12]],o.flash>0?'#e9e5b8':'#586859');
      this.rect(-11,-32,22,17,'#263b38');this.rect(-7,-30,14,11,'#cfac65');this.rect(-4,-28,8,7,'#733f38');
      const f=o.face||-1;this.rect(f<0?-33:5,-28,28,8,'#25373a');this.rect(f<0?-33:27,-27,6,6,'#91977b');this.rect(-17,-15,35,3,'#809073');
      this.rect(-17,-9,4,4,'#c0b579');this.rect(13,-9,4,4,'#c0b579');
      if(o.fireFlash>0)this.rect(f<0?-39:34,-29,7,9,'#ffce80');
      c.restore();
    }
    capsule(o,cam,t) {
      const x=Math.round(o.x-cam),y=Math.round(o.y),c=this.ctx;
      this.poly([[x-33,y-5],[x-18,y-14],[x-10,y-8],[x+10,y-8],[x+18,y-14],[x+33,y-5],[x+14,y+5],[x-14,y+5]],'#9aab9c');
      this.rect(x-31,y-4,15,3,'#dbe0bd');this.rect(x+16,y-4,15,3,'#dbe0bd');this.rect(x-13,y-10,26,20,'#253f43');this.rect(x-10,y-8,20,16,o.flash>0?'#fff0bb':'#bd694e');
      this.rect(x-7,y-6,14,3,'#f2bd75');this.rect(x-3,y-3,6,9,'#fbdd97');this.rect(x-6,y,12,3,'#fbdd97');
      this.rect(x-14,y+9,28,2,'#617b72');
      if(Math.floor(t*8)%2===0){this.rect(x-21,y+4,6,3,'#77b9ad');this.rect(x+15,y+4,6,3,'#77b9ad');}
    }
    pickup(o,cam,t) {
      const x=Math.round(o.x-cam),y=Math.round(o.y+Math.sin((o.t||t)*5)*3),c=this.ctx;
      const color={S:'#f0c466',M:'#83cfac',L:'#8cd9e0',B:'#b8abe0',R:'#eb8a6b'}[o.type]||C.yellow;
      this.poly([[x-8,y-15],[x+8,y-15],[x+15,y-8],[x+15,y+8],[x+8,y+15],[x-8,y+15],[x-15,y+8],[x-15,y-8]],'#192f35');
      this.rect(x-10,y-13,20,2,color);this.rect(x-13,y-10,2,20,color);this.rect(x+11,y-10,2,20,color);this.rect(x-10,y+11,20,2,color);
      this.rect(x-9,y-9,18,18,'#33534b');c.fillStyle=color;c.font='bold 21px monospace';c.textAlign='center';c.textBaseline='middle';c.fillText(o.type,x,y+1);
      this.rect(x-18,y+18,6,2,'#5e8a75');this.rect(x+12,y+18,6,2,'#5e8a75');
    }
    boss(b,cam,t) {
      if(!b)return;
      const floor=b.y||430,left=Math.round((b.wallX==null?b.x-130:b.wallX)-cam),w=270,right=left+w,top=floor-210;
      if(left>1000||right<-40)return;
      const steel='#94aaa2',light='#c7d1bb',edge='#e0dfc2',shade='#637e79',dark='#2c484c',black='#182f35';
      // A broad, front-facing 8-bit base wall. The left edge is the physical wall.
      this.rect(left+8,top-8,w-16,8,shade);
      this.rect(left+16,top-12,w-32,4,light);
      this.rect(left,top,w,floor-top,steel);
      this.rect(left,top,8,floor-top,light);
      this.rect(right-8,top,8,floor-top,shade);
      this.rect(left,top,w,6,edge);
      this.rect(left+8,top+6,w-16,5,shade);
      // Staggered concrete courses give the facade the chunky NES fortress rhythm.
      for(let row=0;row<6;row++){
        const yy=top+14+row*28;
        this.rect(left+9,yy+24,w-18,3,dark);
        for(let col=0;col<6;col++){
          const xx=left+10+col*48-(row%2)*24;
          if(xx>left+8&&xx<right-10){this.rect(xx,yy,3,24,shade);this.rect(xx+3,yy+2,2,20,light);}
        }
      }
      // Thick side posts, square bolts and horizontal metal straps frame the guns.
      for(const xx of [left+8,right-24]){
        this.rect(xx,top+12,16,floor-top-16,shade);
        this.rect(xx,top+12,4,floor-top-16,light);
        for(let yy=top+22;yy<floor-6;yy+=34){this.rect(xx+6,yy,6,6,dark);this.rect(xx+6,yy,4,3,edge);}
      }
      this.rect(left+24,top+42,w-48,8,dark);
      this.rect(left+26,top+43,w-52,3,light);
      this.rect(left+24,top+109,w-48,8,dark);
      this.rect(left+26,top+110,w-52,3,light);
      // Small grille panels remain distinct from the fully exposed red weak point.
      for(const xx of [left+31,right-65]){
        this.rect(xx,floor-64,34,48,dark);
        this.rect(xx+2,floor-62,30,3,light);
        for(let yy=floor-55;yy<floor-18;yy+=8){this.rect(xx+4,yy,26,4,shade);this.rect(xx+4,yy,26,1,light);}
      }
      // The lower red power unit is always targetable. Never draw a closing gate.
      const core=b.core||{x:b.x,y:floor-32,w:66,h:44};
      const cx=Math.round(core.x-cam),cy=Math.round(core.y),cw=core.w||66,ch=core.h||44,alive=b.hp>0;
      this.rect(cx-cw/2-10,cy-ch/2-8,cw+20,ch+14,black);
      this.rect(cx-cw/2-7,cy-ch/2-6,cw+14,ch+10,shade);
      this.rect(cx-cw/2-7,cy-ch/2-6,cw+14,4,edge);
      this.rect(cx-cw/2-7,cy-ch/2-2,4,ch+5,light);
      this.rect(cx-cw/2,cy-ch/2,cw,ch,alive?'#8e302d':'#252f30');
      if(alive){
        const flash=b.flash>0,pulse=Math.sin(t*5)>0;
        this.rect(cx-cw/2+4,cy-ch/2+4,cw-8,ch-8,flash?'#fff1c9':'#d24c3b');
        this.rect(cx-cw/2+7,cy-ch/2+5,cw-14,5,flash?'#ffffff':'#f17b51');
        this.rect(cx-cw/2+4,cy+ch/2-8,cw-8,4,flash?'#ffe7ab':'#a8302c');
        // Red recessed corners and a bright central panel read as one vulnerable unit.
        this.rect(cx-17,cy-12,34,24,flash?'#fffad7':pulse?'#ed6945':'#df5b3d');
        this.rect(cx-11,cy-8,22,16,flash?'#ffffff':'#f69a5d');
        this.rect(cx-8,cy-5,16,3,flash?'#ffffff':'#ffd58c');
        this.rect(cx-cw/2+6,cy-3,5,9,'#842e2b');this.rect(cx+cw/2-11,cy-3,5,9,'#842e2b');
      }else{
        this.rect(cx-cw/2+4,cy-ch/2+4,cw-8,ch-8,'#13262b');
        this.line(cx-26,cy-13,cx-8,cy+11,'#56625b',4);this.line(cx+24,cy-14,cx+8,cy+10,'#56625b',4);
        this.rect(cx-12,cy+10,25,5,'#643b30');
      }
      for(const xx of [cx-cw/2-5,cx+cw/2+3])for(const yy of [cy-ch/2-3,cy+ch/2+2]){this.rect(xx,yy,4,4,edge);}
      // Upper red muzzle ports: the charge animation telegraphs each aimed shell.
      (b.turrets||[]).forEach(q=>{
        const xx=Math.round(q.x-cam),yy=Math.round(q.y),charge=Math.max(0,Math.min(1,q.charge||0));
        this.rect(xx-25,yy-25,50,50,dark);
        this.rect(xx-23,yy-23,46,46,light);
        this.rect(xx-20,yy-20,40,40,shade);
        this.rect(xx-18,yy-18,36,36,black);
        for(const dx of [-21,18])for(const dy of [-21,18]){this.rect(xx+dx,yy+dy,3,3,edge);}
        if(q.hp>0){
          const ring=q.flash>0?'#fff1c4':charge>.65?'#ef9b56':'#c94b3c';
          this.poly([[xx-10,yy-17],[xx+10,yy-17],[xx+17,yy-10],[xx+17,yy+10],[xx+10,yy+17],[xx-10,yy+17],[xx-17,yy+10],[xx-17,yy-10]],ring);
          this.rect(xx-10,yy-13,20,4,q.flash>0?'#ffffff':'#f37b53');
          this.rect(xx-12,yy-9,24,20,'#7d302d');
          this.rect(xx-8,yy-8,16,16,charge>.3?'#b84b35':'#1a2c31');
          if(charge>0){
            const r=charge>.7?6:charge>.35?4:2;
            this.rect(xx-r,yy-r,r*2,r*2,charge>.7?'#ffe0a0':'#ee8950');
            this.rect(xx-2,yy-2,4,4,charge>.85?'#fff5ce':'#ffc87b');
          }
          if(charge>.82&&Math.floor(t*15)%2===0){this.rect(xx-2,yy-23,4,5,'#ffc176');this.rect(xx-23,yy-2,5,4,'#ffc176');this.rect(xx+18,yy-2,5,4,'#ffc176');}
        }else{
          this.poly([[xx-13,yy-15],[xx+12,yy-15],[xx+17,yy-7],[xx+13,yy+14],[xx-8,yy+16],[xx-17,yy+5]],'#17282b');
          this.line(xx-16,yy-16,xx-5,yy-6,'#4d5f59',3);this.line(xx+15,yy+15,xx+5,yy+4,'#4d5f59',3);
          this.rect(xx-10,yy+9,8,4,'#634233');this.rect(xx+5,yy-13,7,4,'#614137');
        }
      });
      this.rect(left-4,floor-4,w+8,6,light);
      this.rect(left-8,floor+2,w+16,8,shade);
      this.rect(left-8,floor+2,w+16,2,edge);
    }
    bullet(b,cam,t){
      const x=Math.round(b.x-cam),y=Math.round(b.y);
      if(b.type==='grenade'){this.rect(x-4,y-6,8,12,'#c3613e');this.rect(x-6,y-4,12,8,'#c3613e');this.rect(x-4,y-4,8,8,'#b8ac68');this.rect(x-2,y-2,4,4,'#fae6a1');this.rect(x-2,y-8,4,3,'#e4b96e');this.rect(x,y-10,2,2,'#ffdfa1');return;}
      if(b.enemy){
        if(b.boss){
          this.poly([[x-3,y-6],[x+3,y-6],[x+6,y-3],[x+6,y+3],[x+3,y+6],[x-3,y+6],[x-6,y+3],[x-6,y-3]],'#bc4535');
          this.rect(x-4,y-4,8,8,'#f3944d');this.rect(x-2,y-2,4,4,'#fff0b5');
        }else{this.rect(x-4,y-4,8,8,'#ad4e3d');this.rect(x-3,y-3,6,6,'#f5a467');this.rect(x-1,y-1,3,3,'#fff0b2');}
        return;
      }
      if(b.type==='L'){
        const n=Math.hypot(b.vx,b.vy)||1,dx=b.vx/n,dy=b.vy/n;
        this.line(x-dx*26,y-dy*26,x+dx*10,y+dy*10,'#4b9fa9',6);this.line(x-dx*24,y-dy*24,x+dx*11,y+dy*11,'#b8f1d9',2);return;
      }
      const n=Math.hypot(b.vx,b.vy)||1;this.line(x-b.vx/n*7,y-b.vy/n*7,x,y,b.type==='S'?'#e9a950':'#e3ca7b',3);this.rect(x-2,y-2,4,4,'#fff2b4');
    }
    draw(g,dt) {
      const c=this.ctx,cam=g.cam||0,t=g.time||0;
      c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;this.background(g);
      c.save();
      if(g.shake>0)c.translate(Math.floor(Math.sin(t*81)*g.shake),Math.floor(Math.cos(t*67)*g.shake*.6));
      (g.level?.platforms||[]).forEach(p=>this.terrain(p,cam,t));
      this.boss(g.boss,cam,t);
      (g.capsules||[]).filter(o=>o.hp>0).forEach(o=>this.capsule(o,cam,t));
      (g.pickups||[]).forEach(o=>this.pickup(o,cam,t));
      (g.enemies||[]).forEach(o=>{if(o.hp<=0||o.active===false||o.x<cam-70||o.x>cam+1030)return;if(o.type==='turret')this.turret(o,cam,t);else this.soldier(o,cam,t,false);});
      if(g.player)this.soldier(g.player,cam,t,true);
      (g.bullets||[]).forEach(o=>this.bullet(o,cam,t));
      (g.particles||[]).forEach(p=>{c.globalAlpha=Math.min(1,Math.max(0,p.life/(p.maxLife||.5)));this.rect(p.x-cam,p.y,p.size||3,p.size||3,p.color||'#ffbe73');});c.globalAlpha=1;
      // Foreground vegetation frames the stage without hiding the hitboxes.
      for(let i=Math.floor(cam/470)-1;i<Math.floor(cam/470)+4;i++){
        const x=i*470-cam+58;if(x<-70||x>1010)continue;
        const ground=(g.level?.platforms||[]).find(p=>!p.broken&&p.type==='ground'&&i*470+58>=p.x&&i*470+58<=p.x+p.w);
        if(ground){this.fern(x,533,1.8,'#0a2c2e',-1);this.fern(x+22,540,2.0,'#103c32');this.fern(x+43,540,1.5,'#164735',-1);}
      }
      c.restore();
      // Discrete edge shade, preserving the bold pixel palette.
      c.globalAlpha=.11;this.rect(0,0,960,4,'#000');this.rect(0,536,960,4,'#000');c.globalAlpha=1;
    }
  }
  window.GameRenderer=GameRenderer;
})();
