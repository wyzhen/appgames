/* Original 8-bit artwork for Base 1. All entity coordinates are screen-space. */
(() => {
  'use strict';
  const palettes = [
    {wall:'#417b6d',wallHi:'#77ad8c',wallD:'#214b48',floor:'#285950',tile:'#31685a',trim:'#9cbea0',accent:'#b2c87d'},
    {wall:'#436e83',wallHi:'#79a5b5',wallD:'#233f59',floor:'#244957',tile:'#2b5863',trim:'#a6c2bb',accent:'#86c4d1'},
    {wall:'#5c7e75',wallHi:'#95b298',wallD:'#304b49',floor:'#34584c',tile:'#3c6452',trim:'#bfd1aa',accent:'#e0c77f'},
    {wall:'#4b7757',wallHi:'#87a870',wallD:'#294833',floor:'#2d513b',tile:'#365f43',trim:'#b0c590',accent:'#d7b779'},
    {wall:'#3c6c78',wallHi:'#75a8a4',wallD:'#203e4c',floor:'#224b50',tile:'#2c5c5b',trim:'#a3c6af',accent:'#7ed1c7'},
    {wall:'#4b7381',wallHi:'#8babae',wallD:'#283f54',floor:'#293f53',tile:'#314e60',trim:'#b9c7b1',accent:'#e7b278'}
  ];
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  class BaseRenderer {
    constructor(canvas) {
      this.canvas=canvas;canvas.width=960;canvas.height=540;
      this.ctx=canvas.getContext('2d',{alpha:false});
      this.ctx.imageSmoothingEnabled=false;
    }
    rect(x,y,w,h,color){if(w<=0||h<=0)return;const c=this.ctx;c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));}
    poly(points,color){const c=this.ctx;c.fillStyle=color;c.beginPath();for(let i=0;i<points.length;i++){const p=points[i];if(i)c.lineTo(Math.round(p[0]),Math.round(p[1]));else c.moveTo(Math.round(p[0]),Math.round(p[1]));}c.closePath();c.fill();}
    line(x0,y0,x1,y1,color,size=2){
      x0=Math.round(x0/2);y0=Math.round(y0/2);x1=Math.round(x1/2);y1=Math.round(y1/2);
      const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let err=dx+dy;
      for(let n=0;n<750;n++){this.rect(x0*2,y0*2,size,size,color);if(x0===x1&&y0===y1)break;const e=2*err;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}}
    }
    bolt(x,y,color='#bfd0ae'){this.rect(x-2,y-2,5,5,'#102d35');this.rect(x-1,y-1,3,3,color);}
    ring(x,y,r,color,width=3,angle=0){
      for(let i=0;i<24;i++){const a=i*Math.PI/12+angle;this.rect(x+Math.cos(a)*r-width/2,y+Math.sin(a)*r-width/2,width,width,color);}
    }
    floor(p,progress=0) {
      const c=this.ctx;
      this.poly([[0,540],[960,540],[760,310],[200,310]],p.floor);
      const rows=[0,.105,.25,.44,.69,1.02];
      for(let row=0;row<rows.length-1;row++){
        let u=rows[row],v=rows[row+1];
        if(progress){const shift=progress*.3;u=(u+shift)%1.05;v=u+(rows[row+1]-rows[row]);}
        const y0=310+230*u,y1=310+230*v,L0=200-200*u,R0=760+200*u,L1=200-200*v,R1=760+200*v;
        for(let col=0;col<10;col++){
          const a=col/10,b=(col+1)/10;
          this.poly([[L0+(R0-L0)*a,y0],[L0+(R0-L0)*b,y0],[L1+(R1-L1)*b,y1],[L1+(R1-L1)*a,y1]],(col+row)%2?p.tile:p.floor);
        }
        this.line(L0,y0,R0,y0,'#142f33',3);this.line(L0,y0+3,R0,y0+3,p.wallHi,1);
      }
      for(let i=0;i<=10;i++){
        const a=i/10;this.line(200+560*a,310,-40+1040*a,558,'#153332',3);
        this.line(204+560*a,312,-36+1040*a,558,p.wallHi,1);
      }
      // Recessed rails lead toward the door and strengthen the view into depth.
      this.poly([[172,310],[190,310],[69,540],[44,540]],'#122e34');
      this.poly([[770,310],[788,310],[916,540],[891,540]],'#122e34');
      this.line(178,314,56,540,p.accent,3);this.line(783,314,904,540,p.accent,3);
      this.rect(0,518,960,3,'#173a3c');this.rect(0,521,960,2,p.wallHi);
      for(let i=0;i<14;i++)this.rect(i*72+10,529,44,2,'#416b62');
    }
    corridor(g,p) {
      const c=this.ctx,t=g.time||0,index=clamp(g.roomIndex||0,0,5);
      this.rect(0,0,960,540,'#0a1c2b');
      // Ceiling, side-wall planes and the far bulkhead use a restricted 8-bit palette.
      this.poly([[0,0],[960,0],[760,104],[200,104]],'#172e3c');
      this.poly([[0,0],[200,104],[200,310],[0,470]],p.wallD);
      this.poly([[960,0],[760,104],[760,310],[960,470]],p.wallD);
      this.poly([[0,0],[190,110],[190,309],[0,459]],p.wall);
      this.poly([[960,0],[770,110],[770,309],[960,459]],p.wall);
      this.rect(196,100,568,215,'#122e36');
      this.floor(p,(g.phase==='advance'||g.phase==='transition')?(g.advanceProgress||0):0);
      // Rows and receding vertical joints are perspective-correct on each wall.
      for(let side=0;side<2;side++){
        const X=x=>side?960-x:x;
        for(let row=1;row<9;row++){
          const k=row/9,outer=-18+k*490,inner=104+k*206;
          this.line(X(0),outer,X(195),inner,p.wallD,4);
          this.line(X(0),outer+5,X(195),inner+3,p.wallHi,2);
          for(let d=0;d<4;d++){
            const x=[0,68,119,159,195][d]+(row%2?15:0);
            if(x>=194)continue;
            const yA=outer+(inner-outer)*(x/195),yB=(-18+(row+1)/9*490)+((104+(row+1)/9*206)-(-18+(row+1)/9*490))*(x/195);
            this.line(X(x),yA,X(x),yB,p.wallD,3);
          }
        }
        for(const x of [12,128,190]){
          const top=x/195*104,bottom=470-(x/195)*160;
          this.line(X(x),top,X(x),bottom,'#173b40',6);
          this.line(X(x+4),top+3,X(x+4),bottom-3,p.wallHi,3);
        }
        // Utility pipes and recessed vents sit on the nearer wall faces.
        this.line(X(29),24,X(29),411,'#15353c',10);this.line(X(31),26,X(31),409,p.trim,3);
        for(let j=0;j<4;j++){const yy=116+j*62;this.line(X(40),yy,X(96),yy+8,'#12363a',7);this.line(X(42),yy-2,X(94),yy+6,p.wallHi,2);}
        for(let j=0;j<5;j++){const x=54+j*10;this.line(X(x),271-j*4,X(x),312-j*4,'#163d3e',4);}
      }
      // Overhead beams and paired fluorescent fixtures converge toward the room.
      for(let i=0;i<4;i++){
        const d=i/4,yy=16+79*d,w=912-352*d,left=(960-w)/2;
        this.rect(left,yy,w,4,'#0b2230');this.rect(left+4,yy+5,w-8,3,p.wallD);
      }
      this.poly([[107,41],[311,84],[351,84],[144,40]],'#294a4b');
      this.poly([[118,44],[315,82],[337,82],[139,44]],'#bfd6b4');
      this.poly([[853,41],[649,84],[609,84],[816,40]],'#294a4b');
      this.poly([[842,44],[645,82],[623,82],[821,44]],'#bfd6b4');
      this.rect(200,101,560,8,p.trim);this.rect(200,109,560,5,p.wallD);
      this.rect(198,112,8,199,p.wallHi);this.rect(754,112,8,199,p.wallHi);
      this.rect(202,306,556,7,p.wallHi);
      const clear=g.phase==='advance'||g.phase==='transition'||(g.targets&&g.targets.length>0&&g.targets.every(q=>q.hp<=0));
      this.bulkhead(g,p,clear);
      // Each chamber has a different utility module and a stencilled room number.
      const colors=['#82c17d','#80bac6','#d5bd6f','#c79b65','#87d2be','#d3b97f'];
      this.rect(218,121,36,18,'#15383c');this.rect(221,124,30,3,colors[index]);
      for(let j=0;j<=index;j++)this.rect(223+j*5,132,3,3,colors[index]);
      for(let side=0;side<2;side++){
        const x=side?711:260;this.rect(x,121,24,7,p.wallD);this.rect(x+2,122,20,2,p.wallHi);
        for(let j=0;j<3;j++){this.rect(x+2,137+j*7,18,3,p.wallD);this.rect(x+3,137+j*7,14,1,p.wallHi);}
      }
      if(index===2||index===4){for(let j=0;j<4;j++){this.rect(209+j*10,284,6,14,j%2?p.accent:'#233d3a');this.rect(716+j*10,284,6,14,j%2?'#233d3a':p.accent);}}
      // Tiny status lamps are restrained so red targets remain visually dominant.
      for(let i=0;i<4;i++)this.rect(688+i*9,293,4,4,clear?'#9dc77e':(i===Math.floor(t*1.5)%4?'#cfb66a':'#345f57'));
    }
    bulkhead(g,p,clear) {
      const c=this.ctx,advance=(g.phase==='advance'||g.phase==='transition')?clamp(g.advanceProgress||0,0,1):0;
      this.rect(208,114,544,190,p.wallD);
      // The door is modular, with solid panels surrounding live red targets.
      if(clear){
        this.rect(290,124,380,181,'#071b29');
        this.poly([[290,124],[342,150],[342,280],[290,305]],'#1f504d');
        this.poly([[670,124],[618,150],[618,280],[670,305]],'#1f504d');
        this.poly([[290,305],[670,305],[618,280],[342,280]],'#1e493f');
        this.rect(342,150,276,130,'#193b3d');
        this.rect(356,159,248,7,p.wallHi);this.rect(356,166,6,114,p.wall);this.rect(598,166,6,114,p.wall);
        this.rect(394,177,172,97,'#0a2630');
        this.poly([[430,272],[530,272],[493,232],[467,232]],'#557d5c');
        this.poly([[472,249],[488,249],[488,226],[502,226],[480,207],[458,226],[472,226]],'#b3d592');
        // Ragged door edges and snapped red wires show that the control was destroyed.
        for(let side=0;side<2;side++)for(let j=0;j<6;j++){
          const x=side?660:278,y=131+j*28;this.rect(x,y,side?16:18,16,p.wallHi);this.rect(x+(side?-6:16),y+4,8,6,p.wallD);
        }
      }
      for(let col=0;col<8;col++){
        const x=212+col*67;
        if(clear&&col>=1&&col<=6)continue;
        this.rect(x,117,62,184,p.wall);
        this.rect(x+2,119,4,180,p.wallHi);this.rect(x+9,119,49,3,p.trim);
        this.rect(x+58,122,4,176,p.wallD);
        for(let yy=143;yy<300;yy+=39){this.rect(x+8,yy,50,3,p.wallD);this.rect(x+8,yy+3,50,1,p.wallHi);}
        this.bolt(x+13,128,p.trim);this.bolt(x+49,289,p.trim);
      }
      if(!clear){
        this.rect(280,126,400,12,'#274e4c');this.rect(282,128,396,3,p.wallHi);
        this.rect(280,278,400,14,'#274e4c');this.rect(282,279,396,3,p.wallHi);
      }
    }
    bossWall(g,p) {
      const b=g.boss||{},phase=b.phase||1,c=this.ctx;
      // Unlike the corridors, the final room is a single broad machinery wall.
      this.rect(170,90,620,230,'#243e51');this.rect(174,94,612,222,p.wallHi);
      this.rect(182,103,596,204,p.wallD);this.rect(190,110,580,192,p.wall);
      for(let row=0;row<5;row++)for(let col=0;col<12;col++){
        const xx=193+col*48,yy=113+row*37;
        this.rect(xx,yy,43,32,(col+row)%2?p.wall:p.wallHi);
        this.rect(xx,yy,43,3,p.trim);this.rect(xx+40,yy+3,3,29,p.wallD);
      }
      this.rect(191,144,578,8,p.wallD);this.rect(193,145,574,2,p.trim);
      this.rect(191,268,578,9,p.wallD);this.rect(193,269,574,2,p.trim);
      for(const x of [198,746]){this.rect(x,111,16,187,p.wallD);this.rect(x,111,4,187,p.trim);for(let y=124;y<298;y+=30)this.bolt(x+9,y,p.trim);}
      // Cable housings and a central, cold reactor mount precede the eye phase.
      for(let side=0;side<2;side++){
        const x=side?639:259;this.rect(x,157,62,108,'#233e4a');
        for(let i=0;i<8;i++){this.rect(x+5,162+i*12,52,6,p.wallHi);this.rect(x+5,162+i*12,52,2,p.trim);}
      }
      this.poly([[405,122],[555,122],[582,151],[582,253],[553,280],[407,280],[378,253],[378,151]],'#1b3444');
      this.poly([[412,129],[548,129],[572,153],[572,248],[548,272],[412,272],[388,248],[388,153]],'#819c9c');
      this.rect(405,150,150,101,'#2d5260');
      if(phase===1){
        this.rect(413,158,134,86,'#466d77');
        for(let j=0;j<7;j++){this.rect(418+j*18,162,12,77,'#6a8e92');this.rect(418+j*18,162,4,77,'#aec2af');}
        this.rect(413,198,134,7,'#253f4d');
        this.rect(461,185,38,32,'#274654');this.rect(467,190,26,22,'#719394');
      }
      this.rect(168,312,624,9,p.trim);this.rect(166,321,628,5,p.wallD);
    }
    target(o,t,boss=false) {
      const x=Math.round(o.x),y=Math.round(o.y),w=o.w||34,h=o.h||34,dead=o.hp<=0;
      const left=x-w/2,top=y-h/2;
      this.rect(left-7,top-6,w+14,h+12,'#15303b');this.rect(left-5,top-5,w+10,h+10,'#9bbaad');
      this.rect(left-3,top-3,w+6,h+6,'#355b5d');
      if(dead){
        this.rect(left,top,w,h,'#14242e');this.line(left+3,top+3,x-1,y+3,'#4f695f',3);this.line(x+2,y-3,left+w-4,top+h-4,'#4f695f',3);
        this.rect(left+3,top+h-7,Math.max(4,w-8),4,'#6b4b39');return;
      }
      const flash=o.flash>0;
      if(o.type==='turret'){
        this.rect(left,top,w,h,'#252c39');
        if(o.open!==false){
          this.poly([[left+5,top],[left+w-5,top],[left+w,top+5],[left+w,top+h-5],[left+w-5,top+h],[left+5,top+h],[left,top+h-5],[left,top+5]],flash?'#fff1c0':'#a94d43');
          this.rect(left+4,top+3,w-8,4,flash?'#fff9d7':'#e98e61');
          this.rect(left+7,top+7,w-14,h-14,'#412b36');
          const charge=clamp(o.charge||0,0,1),r=charge>.7?6:4;
          this.rect(x-r,y-r,r*2,r*2,charge>.4?'#ffc981':'#d37249');
          if(charge>.75){this.rect(x-2,y-2,4,4,'#fff4c5');this.rect(x-2,top-9,4,5,'#f6b66d');}
        }else{
          for(let j=0;j<4;j++){this.rect(left+j*w/4,top,w/4-2,h,'#678b8a');this.rect(left+j*w/4+1,top+1,2,h-2,'#b4c5ab');}
          this.rect(left,top+h/2-2,w,4,'#314a53');
        }
      }else{
        this.rect(left,top,w,h,flash?'#fff0be':'#832d37');
        this.rect(left+3,top+3,w-6,h-6,flash?'#fff9d4':'#d84b47');
        this.rect(left+5,top+4,w-10,Math.max(3,h*.13),flash?'#ffffff':'#f39d6c');
        this.rect(left+6,top+h-8,w-12,4,'#a53636');
        const r=Math.max(4,Math.min(w,h)*.22);
        this.rect(x-r,y-r,r*2,r*2,flash?'#fffefa':Math.sin(t*5)>0?'#f7af70':'#e88357');
        this.rect(x-r+2,y-r+2,Math.max(2,r*2-4),3,'#ffe0a0');
      }
      this.bolt(left-3,top-3);this.bolt(left+w+3,top+h+3);
    }
    eye(o,g) {
      const x=o.x||480,y=o.y||190,w=o.w||100,h=o.h||72,t=g.time||0,c=this.ctx,dead=o.hp<=0,flash=o.flash>0;
      this.rect(x-w/2-12,y-h/2-10,w+24,h+20,'#172e3e');
      this.poly([[x-w*.55,y-h*.5],[x+w*.55,y-h*.5],[x+w*.78,y-h*.18],[x+w*.78,y+h*.18],[x+w*.55,y+h*.5],[x-w*.55,y+h*.5],[x-w*.78,y+h*.18],[x-w*.78,y-h*.18]],'#5c8b94');
      this.poly([[x-w*.48,y-h*.48],[x+w*.48,y-h*.48],[x+w*.7,y],[x+w*.48,y+h*.48],[x-w*.48,y+h*.48],[x-w*.7,y]],'#b9cbb6');
      this.poly([[x-w/2,y],[x-w*.3,y-h/2],[x+w*.3,y-h/2],[x+w/2,y],[x+w*.3,y+h/2],[x-w*.3,y+h/2]],dead?'#1a2b36':flash?'#fff8d0':'#a7d7ce');
      if(!dead){
        const blink=o.open===false;
        if(blink){this.rect(x-w/2,y-5,w,10,'#375e6b');this.line(x-w/2,y-7,x+w/2,y-7,'#daead0',3);}
        else{
          const look=Math.sin(t*1.3)*4,iris=x+look;
          this.poly([[iris-16,y-24],[iris+16,y-24],[iris+25,y-14],[iris+25,y+14],[iris+16,y+24],[iris-16,y+24],[iris-25,y+14],[iris-25,y-14]],flash?'#fff8c4':'#ce5647');
          this.rect(iris-15,y-19,30,38,flash?'#fffde3':'#ee9d61');this.rect(iris-8,y-17,16,34,'#783546');this.rect(iris-5,y-15,10,30,'#1b2b3b');this.rect(iris-5,y-13,5,7,'#f1e0a9');
          this.rect(x-w*.38,y-5,5,6,'#e6ebce');this.rect(x+w*.32,y+7,5,5,'#79aaa6');
        }
      }else{this.line(x-40,y-24,x+31,y+24,'#496a73',5);this.line(x+27,y-26,x-20,y+19,'#496a73',4);}
    }
    barrier(g) {
      const t=g.time||0,on=g.barrierActive,stun=g.stun||g.player?.stun||0;
      for(const x of [133,827]){
        this.rect(x-9,319,18,34,'#143546');this.rect(x-6,321,12,28,'#85a9a3');this.rect(x-5,323,4,23,'#c1d4b9');
        this.rect(x-8,331,16,10,on?'#88d0df':'#416875');
        this.rect(x-12,350,24,5,'#183b44');
      }
      if(!on){this.rect(143,336,674,2,'#385d5b');return;}
      this.rect(142,329,676,14,'#1d5271');this.rect(142,335,676,3,'#74b7d6');
      for(let pass=0;pass<2;pass++){
        let px=143,py=335;
        for(let x=155;x<=818;x+=12){
          const y=335+Math.round(Math.sin(x*.47+t*(pass?25:-27)+pass*4)*(pass?4:7));
          this.line(px,py,x,y,pass?'#e1f5e1':'#6ec9e7',pass?2:3);px=x;py=y;
        }
      }
      for(let i=0;i<10;i++){const x=151+((i*67+t*35)%650);if((Math.floor(t*12)+i)%3===0){this.rect(x,323,2,5,'#b4e7e4');this.rect(x+3,347,2,4,'#81d1e9');}}
    }
    soldier(o,g,player=false) {
      if(o.dead>0||o.hp<=0)return;
      const c=this.ctx,t=g.time||0;
      if(player&&o.invuln>0&&Math.floor(t*15)%2===0)return;
      const jump=player?(o.jumpHeight||0):0,x=Math.round(o.x),base=o.y||430,y=Math.round(base-jump);
      const shadow=player?25:18;
      this.rect(x-shadow/2,base-1,shadow,3,'#102e35');this.rect(x-shadow/2+4,base+2,shadow-8,2,'#173b3b');
      c.save();c.translate(x,y);
      if(!player)c.scale(.84,.84);
      else if(!o.prone)c.scale(1,.84);
      const red=o.type==='supply',skin=o.flash>0?'#fff4ce':'#dfb381',pants=player?'#477eb0':red?'#b64a4d':'#638654',dark=player?'#24466e':red?'#70313d':'#344e3d';
      if(player){
        if(o.prone){
          // Low back-facing silhouette: high shots at y403 clear the head at y414.
          this.rect(-10,-7,8,8,pants);this.rect(3,-7,8,8,dark);this.rect(-11,-1,10,3,'#162f44');this.rect(3,-1,10,3,'#162f44');
          this.rect(-11,-11,22,7,skin);this.rect(-8,-14,16,5,'#a97b5c');this.rect(-6,-16,12,8,'#342f36');this.rect(-7,-13,14,3,'#d35c56');
          this.rect(-14,-10,5,7,skin);this.rect(9,-10,5,7,skin);this.rect(-2,-24,4,12,'#142d3c');this.rect(-1,-23,2,8,'#a0b5b3');
        }else{
          const moving=g.phase==='advance'||g.phase==='transition'||Math.abs(o.vx||0)>5,phase=moving?Math.sin(t*17):0,leg=jump?5:phase*5;
          this.rect(-11,-18,9,16-leg,pants);this.rect(3,-18,9,16+leg,dark);this.rect(-12,-3-leg,11,5,'#162e42');this.rect(3,-3+leg,11,5,'#162e42');
          this.rect(-9,-17,2,11,'#70a2c1');this.rect(4,-15,2,10,'#5b8dae');
          this.rect(-10,-33,21,18,skin);this.rect(-10,-20,21,5,'#203b50');this.rect(-10,-32,4,13,'#ba835e');this.rect(-5,-31,12,7,'#eec28e');
          this.rect(-6,-47,13,13,'#33353a');this.rect(-7,-44,15,4,'#d85f56');this.rect(-13,-42,7,3,'#bb494c');this.rect(-17,-39,8,2,'#ca5450');this.rect(-4,-35,9,3,skin);
          this.rect(-14,-35,5,15,skin);this.rect(10,-35,5,15,skin);this.rect(-12,-38,6,6,skin);this.rect(7,-38,6,6,skin);
          this.rect(-2,-56,4,21,'#102b39');this.rect(-1,-54,2,16,'#91a9ad');this.rect(-4,-43,8,6,'#2e4b53');
        }
        if(o.fireFlash>0){const yy=o.prone?-28:-60;this.rect(-3,yy,6,5,'#fff2b2');this.rect(-6,yy+1,12,2,'#e9b471');}
      }else{
        // Supply soldiers wear a red helmet and red fatigues, other runners green.
        const f=o.dir||o.face||(o.vx<0?-1:1),phase=Math.sin(t*13+(o.anim||0));c.scale(f,1);
        this.rect(-8+phase*4,-14,7,13,pants);this.rect(1-phase*4,-14,7,13,dark);this.rect(-9+phase*4,-3,10,4,'#18313b');this.rect(1-phase*4,-3,10,4,'#18313b');
        this.rect(-9,-29,18,16,pants);this.rect(-9,-16,18,4,'#203c3d');this.rect(-6,-40,12,12,skin);this.rect(-8,-42,15,6,pants);this.rect(-8,-37,18,3,red?'#e68869':'#a0b778');
        this.rect(5,-34,2,2,'#2a3234');this.rect(-9,-28,5,11,skin);this.rect(-5,-23,16,5,skin);this.rect(8,-25,19,5,'#233943');this.rect(20,-27,6,2,'#8da39b');
        if(red){this.rect(-5,-27,8,8,'#f3c16b');this.rect(-3,-25,4,4,'#943d43');}
      }
      c.restore();
      const stun=player&&(g.stun||o.stun||0);
      if(stun){
        for(let i=0;i<5;i++){const a=t*8+i*1.3,xx=x+Math.cos(a)*22,yy=y-26+Math.sin(a)*25;this.line(xx,yy,xx+Math.sin(a)*7,yy+7,'#c2eff1',3);}
        this.ring(x,y-26,29,'#70cce4',2,t*2);
      }
    }
    bullet(b,t) {
      if(b.life<=0)return;const x=Math.round(b.x),y=Math.round(b.y);
      // The engine stores 1 at the far wall and 0 at the player's front plane.
      const depth=1-clamp(b.depth==null?(430-y)/290:b.depth,0,1);
      if(!b.enemy){
        const dx=b.vx||0,dy=b.vy||-1,n=Math.hypot(dx,dy)||1;
        if(b.type==='L'){this.line(x-dx/n*25,y-dy/n*25,x+dx/n*5,y+dy/n*5,'#469da8',6);this.line(x-dx/n*24,y-dy/n*24,x+dx/n*5,y+dy/n*5,'#c9fae4',2);}
        else {this.line(x-dx/n*7,y-dy/n*7,x,y,b.type==='S'?'#f2b769':'#e6d887',3);this.rect(x-1,y-2,3,4,'#fff7c5');}return;
      }
      if(b.type==='mine'||b.kind==='mine'){
        const r=6+depth*5;this.rect(x-r,y+r-1,r*2,3,'#16373a');
        this.poly([[x-r+3,y-r],[x+r-3,y-r],[x+r,y-r+3],[x+r,y+r-3],[x+r-3,y+r],[x-r+3,y+r],[x-r,y+r-3],[x-r,y-r+3]],'#263c42');
        this.ring(x,y,r-2,'#9baa89',3,t*3);this.rect(x-3,y-3,6,6,'#c96446');this.rect(x-1,y-2,3,3,'#ffe1a3');
        for(let i=0;i<4;i++){const a=t*6+i*Math.PI/2;this.rect(x+Math.cos(a)*r-1,y+Math.sin(a)*r-1,3,3,'#e5ae69');}return;
      }
      if(b.type==='ring'||b.ring){
        const r=6+depth*6;this.ring(x,y,r,'#bb5144',5,t*.7);this.ring(x,y,r-1,'#ed995b',3,t*.7);
        for(let i=0;i<7;i++){const a=t*4+i*Math.PI*2/7;this.rect(x+Math.cos(a)*r-2,y+Math.sin(a)*r-2,4,4,'#ffe2a0');}return;
      }
      const r=3+depth*3;
      this.poly([[x-r+2,y-r],[x+r-2,y-r],[x+r,y-r+2],[x+r,y+r-2],[x+r-2,y+r],[x-r+2,y+r],[x-r,y+r-2],[x-r,y-r+2]],'#b84a3d');
      this.rect(x-r+2,y-r+2,Math.max(3,r*2-4),Math.max(3,r*2-4),'#ec9559');this.rect(x-1,y-1,3,3,'#fff3bf');
    }
    pickup(o,t) {
      const x=Math.round(o.x),y=Math.round(o.y),c=this.ctx,color={S:'#f4cc76',M:'#91d4af',L:'#8bd8e2',B:'#b8b7ec',R:'#ed9a77'}[o.type]||'#e7d49a';
      this.poly([[x-8,y-12],[x+8,y-12],[x+12,y-8],[x+12,y+8],[x+8,y+12],[x-8,y+12],[x-12,y+8],[x-12,y-8]],'#1a3341');
      this.rect(x-8,y-11,16,2,color);this.rect(x-11,y-8,2,16,color);this.rect(x+9,y-8,2,16,color);this.rect(x-8,y+9,16,2,color);
      c.fillStyle=color;c.font='bold 17px monospace';c.textAlign='center';c.textBaseline='middle';c.fillText(o.type,x,y+1);
      if(o.homing){this.rect(x-17,y+3,3,3,color);this.rect(x+14,y+3,3,3,color);}
    }
    draw(g,dt) {
      // A shared canvas may previously contain the jungle renderer's state or clip.
      let c=this.ctx;
      if(typeof c.reset==='function')c.reset();else {this.canvas.width=960;c=this.ctx=this.canvas.getContext('2d',{alpha:false});}
      c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.imageSmoothingEnabled=false;
      const time=g.time||0,index=clamp(g.roomIndex||0,0,5),p=palettes[index],advance=(g.phase==='advance'||g.phase==='transition')?clamp(g.advanceProgress||0,0,1):0;
      c.save();
      if(g.shake>0)c.translate(Math.round(Math.sin(time*93)*g.shake),Math.round(Math.cos(time*71)*g.shake*.5));
      if(advance){const zoom=1+advance*1.75;c.translate(480,198);c.scale(zoom,zoom);c.translate(-480,-198);}
      this.corridor(g,p);
      if(g.baseMode==='boss'||index===5)this.bossWall(g,p);
      const eyePhase=(g.baseMode==='boss'||index===5)&&g.boss?.phase===2;
      if(g.phase==='combat'||g.baseMode==='boss')for(const target of g.targets||[]){if(eyePhase&&target.type==='core'&&(target.w>=70||target.id==='eye'))this.eye(target,g);else this.target(target,time,index===5);}
      // Far bullets are drawn behind cross-running soldiers and the electrical fence.
      for(const b of g.bullets||[])if((b.y||0)<335)this.bullet(b,time);
      for(const e of g.enemies||[])if(e.active!==false)this.soldier(e,g,false);
      if(!advance)this.barrier(g);
      c.restore();
      // Near projectiles and the back-facing player retain their actual hitbox positions.
      for(const b of g.bullets||[])if((b.y||0)>=335)this.bullet(b,time);
      for(const item of g.pickups||[])this.pickup(item,time);
      if(g.player)this.soldier(g.player,g,true);
      for(const part of g.particles||[]){c.globalAlpha=clamp(part.life/(part.maxLife||.5),0,1);this.rect(part.x,part.y,part.size||3,part.size||3,part.color||'#f3bb73');}
      c.globalAlpha=1;
      // A brief dark push closes the passage between chambers, rather than a hard cut.
      if(advance>.76){c.globalAlpha=(advance-.76)/.24;this.rect(0,0,960,540,'#061722');c.globalAlpha=1;}

      c.setTransform(1,0,0,1,0,0);
    }
  }
  window.BaseRenderer=BaseRenderer;
})();
