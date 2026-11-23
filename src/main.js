import * as THREE from 'three';
import './style.css';

const $ = id => document.getElementById(id);
const STORE = 'ttr-save-v1';
const defaults = { coins: 0, level: 1, paddle: 0, ball: 0, ownedPaddles: [0], ownedBalls: [0] };
let save;
try { save = { ...defaults, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; }
catch { save = { ...defaults }; }
function persist(){ localStorage.setItem(STORE, JSON.stringify(save)); updateCoins(); }
const paddleSkins = [
  {name:'Classic Red', color:0xe94c56, price:0},
  {name:'Ocean Blue', color:0x2e9bff, price:60},
  {name:'Neon Green', color:0x5cf28b, price:100},
  {name:'Purple Haze', color:0xa66bff, price:150},
  {name:'Gold Rush', color:0xffc34e, price:220},
  {name:'Hot Pink', color:0xff55b7, price:300}
];
const ballSkins = [
  {name:'Classic White', color:0xffffff, price:0},
  {name:'Electric Blue', color:0x40c9ff, price:50},
  {name:'Lime Pop', color:0x9bff55, price:90},
  {name:'Orange Flash', color:0xff963d, price:130},
  {name:'Pink Glow', color:0xff65c8, price:180},
  {name:'Golden', color:0xffd34e, price:250}
];

let scene, camera, renderer, clock, table, net, playerPaddle, botPaddle, ballMesh, ballTrail;
let ball = new THREE.Vector3(0, 0.2, 0), velocity = new THREE.Vector3();
let spin = 0, lastPointerX = 0, pointerMoved = false, running = false, paused = false;
let playerScore = 0, botScore = 0, rallyHits = 0, matchLevel = 1, lastPointAt = 0;
let playerX = 0, botX = 0, targetX = 0, botTargetX = 0, botSkill = 0.36;
let audioCtx = null, musicTimer = null, musicOn = true, audioStarted = false;
const tableLength = 8.4, tableWidth = 4.6;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const mat = (color, roughness=.7)=>new THREE.MeshStandardMaterial({color,roughness});
const paddleMaterial = new THREE.MeshStandardMaterial({color:paddleSkins[save.paddle]?.color || 0xe94c56, roughness:.55});

function updateCoins(){ $('coin-count').textContent=save.coins; $('shop-coins').textContent=save.coins; }
function show(id){ ['home','hud','pause-screen','gameover','shop'].forEach(x=>$(x).classList.add('hidden')); $(id).classList.remove('hidden'); }
function makeBox(w,h,d,material,x,y,z,parent=scene){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material); mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function init3D(){
  scene=new THREE.Scene(); scene.background=new THREE.Color(0x07111f); scene.fog=new THREE.Fog(0x07111f,14,29);
  camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,100);
  camera.position.set(0,7.4,11.9); camera.lookAt(0,0,-.4);
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.7)); renderer.setSize(innerWidth,innerHeight);
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  $('game').appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xb8e5ff,0x172438,2.0));
  const key=new THREE.DirectionalLight(0xffffff,2.5); key.position.set(-4,10,7); key.castShadow=true; scene.add(key);
  const fill=new THREE.PointLight(0x20d8c1,35,18); fill.position.set(5,5,-3); scene.add(fill);
  makeBox(200,.2,200,mat(0x0a1725),0,-.35,0);
  // Table and its legs
  table=new THREE.Group(); scene.add(table);
  makeBox(tableWidth,.22,tableLength,mat(0x087b79,.42),0,0,0,table);
  makeBox(tableWidth+.12,.12,tableLength+.12,mat(0x111c2b),0,-.17,0,table);
  const white=mat(0xe7f7f5,.5);
  makeBox(.045,.025,tableLength-.12,white,-tableWidth/2+.09,.125,0,table);
  makeBox(.045,.025,tableLength-.12,white,tableWidth/2-.09,.125,0,table);
  makeBox(tableWidth-.12,.025,.045,white,0,.125,tableLength/2-.09,table);
  makeBox(tableWidth-.12,.025,.045,white,0,.125,-tableLength/2+.09,table);
  makeBox(tableWidth-.18,.022,.035,white,0,.126,0,table);
  for(const x of [-1.65,1.65]) for(const z of [-3.1,3.1]) makeBox(.16,2.8,.16,mat(0x17283a),x,-1.55,z,table);
  // Net
  net=new THREE.Group(); scene.add(net);
  makeBox(tableWidth,.38,.055,mat(0x152b3e),0,.36,0,net);
  makeBox(tableWidth,.035,.075,mat(0xe7f7f5),0,.57,0,net);
  for(let x=-2.2;x<=2.21;x+=.22) makeBox(.012,.34,.012,mat(0x7894a8),x,.36,0,net);
  // Paddles: no visible player body or hands
  playerPaddle=new THREE.Group(); scene.add(playerPaddle);
  const handle=makeBox(.18,.13,.62,mat(0x392a24),0,0,.46,playerPaddle);
  const head=new THREE.Mesh(new THREE.CylinderGeometry(.72,.72,.16,40),paddleMaterial);
  head.rotation.x=Math.PI/2; head.position.z=-.08; head.castShadow=true; playerPaddle.add(head);
  playerPaddle.position.set(0,.55,3.55);
  botPaddle=new THREE.Group(); scene.add(botPaddle);
  const botHead=new THREE.Mesh(new THREE.CylinderGeometry(.7,.7,.14,40),mat(0x2e9bff));
  botHead.rotation.x=Math.PI/2; botHead.castShadow=true; botPaddle.add(botHead);
  makeBox(.16,.12,.52,mat(0x3a3029),0,0,-.42,botPaddle);
  botPaddle.position.set(0,.55,-3.55);
  const ballMat=new THREE.MeshStandardMaterial({color:ballSkins[save.ball]?.color || 0xffffff,roughness:.25,metalness:.05,emissive:ballSkins[save.ball]?.color || 0xffffff,emissiveIntensity:.08});
  ballMesh=new THREE.Mesh(new THREE.SphereGeometry(.17,24,18),ballMat); ballMesh.castShadow=true; scene.add(ballMesh);
  ballTrail=new THREE.Mesh(new THREE.SphereGeometry(.09,12,10),new THREE.MeshBasicMaterial({color:0x38e4c8,transparent:true,opacity:.28})); scene.add(ballTrail);
  // Subtle arena lights
  for(let x of [-7,7]){const lamp=new THREE.PointLight(0x2e9bff,22,15);lamp.position.set(x,5,-1);scene.add(lamp);}
  clock=new THREE.Clock();
  window.addEventListener('resize',onResize);
  renderer.domElement.addEventListener('pointerdown',onPointerDown);
  renderer.domElement.addEventListener('pointermove',onPointerMove);
  renderer.domElement.addEventListener('pointerup',onPointerUp);
  renderer.domElement.addEventListener('pointercancel',onPointerUp);
  resetBall(true);
  animate();
}
function onResize(){if(!camera||!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
function pointerToTable(e){
  const rect=renderer.domElement.getBoundingClientRect();
  const nx=((e.clientX-rect.left)/rect.width)*2-1;
  return clamp(nx*2.55,-1.95,1.95);
}
function onPointerDown(e){if(!running||paused)return;renderer.domElement.setPointerCapture?.(e.pointerId);lastPointerX=e.clientX;pointerMoved=false;targetX=pointerToTable(e);}
function onPointerMove(e){if(!running||paused)return;const dx=e.clientX-lastPointerX;lastPointerX=e.clientX;if(Math.abs(dx)>1){spin=clamp(spin+dx*.003,-1.5,1.5);pointerMoved=true;}targetX=pointerToTable(e);}
function onPointerUp(){if(pointerMoved){spin=clamp(spin,-1.2,1.2);}}
function startAudio(){
  if(audioStarted)return;
  try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();audioStarted=true;if(musicOn)startMusic();}catch{}
}
function tone(freq=500,duration=.07,type='sine',volume=.08){
  if(!audioCtx)return;
  const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(freq,audioCtx.currentTime);
  gain.gain.setValueAtTime(volume,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);
  osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);
}
function hitSound(){tone(190,.055,'triangle',.12);setTimeout(()=>tone(620,.045,'sine',.045),18);}
function tableSound(){tone(390,.05,'sine',.055);setTimeout(()=>tone(270,.04,'triangle',.025),25);}
function startMusic(){
  if(!audioCtx||musicTimer)return;
  const notes=[261.63,329.63,392,493.88,392,329.63,293.66,349.23];
  let i=0;
  musicTimer=setInterval(()=>{if(!running||paused||!musicOn)return;tone(notes[i++%notes.length],.13,'sine',.018);},260);
}
function stopMusic(){if(musicTimer){clearInterval(musicTimer);musicTimer=null;}}
function resetBall(toBot=false){
  ball.set((Math.random()-.5)*1.2,.32,toBot?-2.55:2.55);
  velocity.set((Math.random()-.5)*.7,0,toBot?4.2:-4.2);
  spin=0;ballMesh.position.copy(ball);ballTrail.position.copy(ball);
}
function setPaddleSkin(){
  const c=paddleSkins[save.paddle]?.color ?? 0xe94c56;
  playerPaddle.children[1].material.color.setHex(c);
  playerPaddle.children[1].material.emissive?.setHex(c);
}
function setBallSkin(){
  const c=ballSkins[save.ball]?.color ?? 0xffffff;
  ballMesh.material.color.setHex(c);ballMesh.material.emissive.setHex(c);
}
function botProfile(){
  const names=['ROOKIE BOT','CLUB PLAYER','RALLY PRO','SPIN MASTER','TABLE TITAN','UNBEATABLE'];
  const idx=Math.min(matchLevel-1,names.length-1);
  return {name:names[idx],skill:Math.min(.34+matchLevel*.075,.9),speed:2.0+Math.min(matchLevel*.22,2.6)};
}
function startMatch(){
  startAudio();playerScore=0;botScore=0;rallyHits=0;
  const p=botProfile();botSkill=p.skill;
  $('bot-name').textContent=p.name;$('round-label').textContent=`LEVEL ${matchLevel} • MATCH ${matchLevel}`;
  updateScore();running=true;paused=false;show('hud');$('hint').textContent='DRAG TO MOVE • SWIPE TO ADD SPIN';
  playerX=targetX=0;botX=botTargetX=0;resetBall(true);
  if(musicOn)startMusic();
}
function updateScore(){$('player-score').textContent=playerScore;$('bot-score').textContent=botScore;}
function point(winner){
  if(!running)return;
  if(winner==='player')playerScore++;else botScore++;
  updateScore();lastPointAt=performance.now();
  if(playerScore>=7||botScore>=7){
    running=false;stopMusic();
    const won=playerScore>botScore;
    const reward=won?(30+Math.min(matchLevel*5,50)):5;
    save.coins+=reward;if(won)save.level=Math.max(save.level,matchLevel+1);
    persist();
    $('result-eyebrow').textContent=won?'VICTORY':'MATCH OVER';
    $('result-title').textContent=won?'YOU WIN!':'NICE TRY!';
    $('result-message').textContent=won?`You defeated ${botProfile().name}. The next bot is tougher!`:'The bot got this one. Try again and master your spin.';
    $('reward-count').textContent='+'+reward;
    $('next-match').textContent=won?'NEXT LEVEL':'TRY AGAIN';
    show('gameover');return;
  }
  resetBall(winner==='player');
}
function hitPlayer(){
  const dx=ball.x-playerX;
  const off=clamp(dx/1.2,-1,1);
  velocity.z=-Math.max(4.4,Math.abs(velocity.z)*1.04);
  velocity.x=off*3.1+spin*1.65;
  velocity.y=.5+Math.abs(spin)*.25;
  spin=0;rallyHits++;hitSound();
}
function hitBot(){
  const dx=ball.x-botX;
  const off=clamp(dx/1.2,-1,1);
  velocity.z=Math.max(4.1,Math.abs(velocity.z)*1.025);
  velocity.x=off*2.2+(Math.random()-.5)*(1.1-botSkill*.7);
  velocity.y=.4+Math.random()*.3;
  rallyHits++;hitSound();
}
function updatePhysics(dt){
  if(!running||paused)return;
  const profile=botProfile();
  playerX+=(targetX-playerX)*Math.min(1,dt*14);
  playerPaddle.position.x=playerX;
  // AI tracks the ball, with skill-dependent reaction delay and imperfect aim.
  if(ball.z<1.2)botTargetX=clamp(ball.x+(Math.random()-.5)*(1.25-botSkill),-1.9,1.9);
  botX+=(botTargetX-botX)*Math.min(1,dt*(3+botSkill*5));
  botPaddle.position.x=botX;
  ball.x+=velocity.x*dt;ball.y+=velocity.y*dt;ball.z+=velocity.z*dt;
  velocity.y-=9.4*dt;
  velocity.x+=spin*dt*1.2;
  // Side walls
  if(Math.abs(ball.x)>2.12){ball.x=clamp(ball.x,-2.12,2.12);velocity.x*=-.82;tableSound();}
  // Bounce off table
  if(ball.y<=.29&&ball.z<4.15&&ball.z>-4.15&&velocity.y<0){
    ball.y=.29;velocity.y=Math.abs(velocity.y)*.72;tableSound();
    if(Math.abs(velocity.y)<.65)velocity.y=.65;
  }
  // Player paddle collision plane
  if(velocity.z>0&&ball.z>3.15&&ball.z<3.65){
    if(Math.abs(ball.x-playerX)<.95&&ball.y<1.45){hitPlayer();}
    else if(ball.z>=3.55){point('bot');return;}
  }
  // Bot paddle collision
  if(velocity.z<0&&ball.z<-3.12&&ball.z>-3.62){
    if(Math.abs(ball.x-botX)<.92&&ball.y<1.5){hitBot();}
    else if(ball.z<=-3.55){point('player');return;}
  }
  if(ball.z>4.35){point('bot');return;}
  if(ball.z<-4.35){point('player');return;}
  ballMesh.position.set(ball.x,ball.y,ball.z);ballTrail.position.set(ball.x-.12,ball.y-.08,ball.z+.2);
  ballMesh.rotation.x+=velocity.z*dt;ballMesh.rotation.z+=velocity.x*dt;
  playerPaddle.rotation.z=clamp((targetX-playerX)*-.18,-.25,.25);
  botPaddle.rotation.z=clamp((botTargetX-botX)*-.18,-.2,.2);
}
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.035);
  updatePhysics(dt);
  if(ballMesh){ballMesh.position.set(ball.x,ball.y,ball.z);ballTrail.position.set(ball.x-.12,ball.y-.08,ball.z+.2);}
  if(renderer)renderer.render(scene,camera);
}
function renderShop(){
  updateCoins();
  const make=(item,index,type)=>{
    const owned=(type==='paddle'?save.ownedPaddles:save.ownedBalls).includes(index);
    const selected=save[type]===index;
    const action=selected?'EQUIPPED':owned?'EQUIP':`🪙 ${item.price}`;
    return `<div class="shop-item"><div class="swatch" style="background:#${item.color.toString(16).padStart(6,'0')}"></div><strong>${item.name}</strong><button data-type="${type}" data-index="${index}" class="${selected?'primary':'secondary'}">${action}</button></div>`;
  };
  $('paddle-items').innerHTML=paddleSkins.map((x,i)=>make(x,i,'paddle')).join('');
  $('ball-items').innerHTML=ballSkins.map((x,i)=>make(x,i,'ball')).join('');
  document.querySelectorAll('.shop-item button').forEach(btn=>btn.addEventListener('click',()=>{
    const type=btn.dataset.type,index=Number(btn.dataset.index),items=type==='paddle'?paddleSkins:ballSkins,owned=type==='paddle'?save.ownedPaddles:save.ownedBalls;
    if(owned.includes(index)){save[type]=index;}
    else if(save.coins>=items[index].price){save.coins-=items[index].price;owned.push(index);save[type]=index;}
    else{tone(120,.12,'square',.04);return;}
    persist();setPaddleSkin();setBallSkin();renderShop();
  }));
}
$('play').addEventListener('click',startMatch);
$('shop-open').addEventListener('click',()=>{renderShop();show('shop');});
$('shop-close').addEventListener('click',()=>show('home'));
$('pause').addEventListener('click',()=>{paused=true;show('pause-screen');});
$('resume').addEventListener('click',()=>{paused=false;show('hud');});
$('quit').addEventListener('click',()=>{running=false;paused=false;stopMusic();show('home');});
$('gameover-home').addEventListener('click',()=>show('home'));
$('next-match').addEventListener('click',()=>{if(playerScore>botScore)matchLevel++;startMatch();});
updateCoins();
try{init3D();}catch(err){console.error(err);$('home').insertAdjacentHTML('beforeend','<p style="color:#ff8b8b">3D graphics could not start on this device.</p>');}
