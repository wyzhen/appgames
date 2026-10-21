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
      if(!b)return;const x=Math.round(b.x-cam),floor=b.y||430;
      if(x>1170||x<-240)return;
      // A jungle-claimed steel and concrete fortress.
      this.rect(x-106,142,212,floor-142,'#192e34');
      this.rect(x-120,157,22,floor-157,'#475650');this.rect(x+98,157,22,floor-157,'#475650');
      for(let yy=164;yy<floor;yy+=32){this.rect(x-117,yy,15,3,'#71806b');this.rect(x+101,yy,15,3,'#71806b');this.rect(x-116,yy+17,4,12,'#2e403d');this.rect(x+110,yy+17,4,12,'#2e403d');}
      this.rect(x-104,139,208,14,'#657365');this.rect(x-94,127,188,13,'#374f47');this.rect(x-91,126,182,3,'#99aa7b');
      this.poly([[x-82,151],[x+82,151],[x+82,floor],[x-82,floor]],'#344a49');
      for(let j=0;j<6;j++){
        this.rect(x-76+j*26,157,22,floor-166,j%2?'#2b4241':'#3d5250');
        this.rect(x-74+j*26,159,2,floor-171,'#657367');
      }
      this.rect(x-70,174,140,64,'#172e32');this.rect(x-65,179,130,51,'#4d594d');
      for(let j=0;j<9;j++)this.rect(x-59+j*14,182,7,43,'#243c3c');
      this.rect(x-28,184,56,29,'#203a3c');this.rect(x-24,188,48,21,'#b08353');
      this.rect(x-20,190,40,3,'#e1b36c');
      this.ctx.fillStyle='#293b34';this.ctx.font='bold 14px monospace';this.ctx.textAlign='center';this.ctx.fillText('01',x,205);
      const cy=floor-95,open=b.coreOpen;
      this.poly([[x-46,cy-42],[x+46,cy-42],[x+56,cy-28],[x+56,cy+28],[x+41,cy+43],[x-41,cy+43],[x-56,cy+28],[x-56,cy-28]],'#14282d');
      this.rect(x-44,cy-33,88,66,'#707a65');this.rect(x-39,cy-28,78,56,'#293a38');
      const alive=b.hp>0;
      if(open&&alive){
        this.rect(x-31,cy-24,62,48,'#6f3735');this.rect(x-25,cy-19,50,38,b.flash>0?'#fff1bb':'#c65444');this.rect(x-17,cy-13,34,26,'#ef8b58');this.rect(x-10,cy-7,20,14,'#ffe1a0');
        this.rect(x-34,cy-27,5,54,'#1f3436');this.rect(x+29,cy-27,5,54,'#1f3436');
      }else{
        for(let j=0;j<6;j++){this.rect(x-32+j*11,cy-22,9,44,alive?'#56655b':'#242f30');this.rect(x-31+j*11,cy-20,2,40,alive?'#8a9278':'#3a4640');}
        this.rect(x-32,cy-2,64,4,alive?'#a05c43':'#3b3531');
      }
      for(let yy=cy-34;yy<=cy+34;yy+=68)for(let xx=x-45;xx<=x+45;xx+=90){this.rect(xx-2,yy-2,5,5,'#bec29a');}
      for(let j=0;j<2;j++){
        const xx=x+(j?-76:76);this.rect(xx-8,floor-38,16,24,'#202f30');for(let r=0;r<4;r++)this.rect(xx-6,floor-36+r*6,12,2,'#b17b4e');
      }
      this.rect(x-120,floor-6,240,10,'#899477');this.rect(x-124,floor+4,248,10,'#3d5147');
      (b.turrets||[]).forEach(q=>{const xx=q.x-cam,yy=q.y;
        this.rect(xx-23,yy-23,46,46,'#1c2d31');this.rect(xx-20,yy-20,40,40,'#87917b');this.rect(xx-16,yy-16,32,32,'#344845');
        if(q.hp>0){this.poly([[xx-15,yy-9],[xx-9,yy-15],[xx+9,yy-15],[xx+15,yy-9],[xx+15,yy+9],[xx+9,yy+15],[xx-9,yy+15],[xx-15,yy+9]],q.flash>0?'#ffe7b0':'#b27a51');this.rect(xx-7,yy-7,14,14,'#2b3331');this.rect(xx-3,yy-3,6,6,'#e9a15a');}else{this.rect(xx-12,yy-12,24,24,'#19282b');this.line(xx-14,yy-14,xx+12,yy+10,'#52584a',3);}
      });
      this.fern(x-112,157,.9,'#3b6e44');this.fern(x+103,153,.7,'#4b7b48',-1);
      this.line(x-89,128,x-87,201,'#447447',3);this.rect(x-90,166,8,5,'#698b4c');this.rect(x-84,186,8,5,'#698b4c');
    }
    bullet(b,cam,t){
      const x=Math.round(b.x-cam),y=Math.round(b.y);
      if(b.type==='grenade'){this.rect(x-4,y-4,8,8,'#86946b');this.rect(x-2,y-7,4,3,'#e4b96e');this.rect(x,y-10,2,2,'#ffdfa1');return;}
      if(b.enemy){this.rect(x-4,y-4,8,8,'#ad4e3d');this.rect(x-3,y-3,6,6,'#f5a467');this.rect(x-1,y-1,3,3,'#fff0b2');return;}
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
