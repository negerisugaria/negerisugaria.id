// DOM references and UI/rendering

const maze = document.getElementById("maze");
const missionEl = document.getElementById("mission");
const progressEl = document.getElementById("progress");
const scoreEl = document.getElementById("score");
const stepsEl = document.getElementById("steps");
const totalScoreEl = document.getElementById("totalScore");
const levelHint = document.getElementById("levelHint");
const startOverlay = document.getElementById("startOverlay");
const introCard = document.getElementById("introCard");
const pickerCard = document.getElementById("pickerCard");
const profileCard = document.getElementById("profileCard");
const questionModal = document.getElementById("questionModal");
const tutorCard = document.getElementById("tutorCard");
const tutorMessage = document.getElementById("tutorMessage");
const visualMath = document.getElementById("visualMath");
const tutorTip = document.getElementById("tutorTip");
const levelModal = document.getElementById("levelModal");
const finalOverlay = document.getElementById("finalOverlay");
function updateDifficulty(){
  document.querySelectorAll("#difficulty button").forEach(btn=>{
    const idx=levelIndex(btn.dataset.level);
    btn.disabled = idx>unlocked || (gameStarted && btn.dataset.level!==levelKey);
    btn.classList.toggle("active",btn.dataset.level===levelKey);
  });
}
function updateHeaderCharacters(){
  const strip=document.getElementById("characterStrip");
  strip.innerHTML=chars.map((c,i)=>`
    <button class="char ${i===selected?"active":""}" data-player="${i}" type="button">
      <img src="${c.img}" alt="${c.name}">
      <div><b>${c.name}</b><span>${i===selected?"PEMAIN":"TARGET"}</span></div>
    </button>`).join("");
  strip.querySelectorAll(".char").forEach(el=>{
    el.onclick=()=>{
      if(gameStarted){showToast("🔒 Karakter sudah dipilih. Gunakan Main Lagi untuk memilih karakter baru.");return;}
      selected=Number(el.dataset.player);
      updateHeaderCharacters();
      renderPicker();
    };
  });
}
function renderPicker(){
  document.getElementById("picker").innerHTML=chars.map((c,i)=>`
    <button class="pick ${i===selected?"selected":""}" data-player="${i}" type="button">
      <img src="${c.img}" alt="${c.name}">
      <b>${c.name}</b>
    </button>`).join("");
  document.querySelectorAll("#picker .pick").forEach(el=>{
    el.onclick=()=>{selected=Number(el.dataset.player);renderPicker();updateHeaderCharacters();};
  });
}

function showIntro(){
  startOverlay.classList.remove("hidden");
  introCard.classList.remove("hidden");
  profileCard.classList.add("hidden");
  pickerCard.classList.add("hidden");
}
function showProfile(){
  introCard.classList.add("hidden");
  profileCard.classList.remove("hidden");
  pickerCard.classList.add("hidden");
  const info=playerEventTracker.getPlayerInfo();
  document.getElementById("playerName").value=info.name||"";
  document.getElementById("playerAge").value=info.age||"";
  setTimeout(()=>document.getElementById("playerName").focus(),50);
}
function showPicker(){
  introCard.classList.add("hidden");
  profileCard.classList.add("hidden");
  pickerCard.classList.remove("hidden");
  renderPicker();
}
function hideStart(){startOverlay.classList.add("hidden");}

function prepareTargets(rng=Math.random){
  // Acak posisi pemain dan semua target. Jarak minimum menjaga karakter
  // tidak muncul berdekatan dan semua posisi tetap dapat dicapai.
  player=choosePlayerStart(rng);
  targetOrder = shuffle(chars.map((_,i)=>i).filter(i=>i!==selected), rng);
  targetSlots = chooseTargets(targetOrder.length, rng, player).map(p=>({x:p.x,y:p.y}));
  targets = targetSlots.map(p=>({x:p.x,y:p.y}));
  nextTarget = 0;
  home = null;
}

function updateNewMazeButton(){
  const btn=document.getElementById("newMaze");
  // Selalu aktif. Pemain dapat membuat labirin baru berkali-kali tanpa
  // menghapus riwayat tracking atau progress level.
  btn.disabled = false;
  btn.title = "Buat labirin baru";
}
function updateMission(){
  const names=targetOrder.map(i=>chars[i].name);
  let text=`Temukan <b>${names.length}</b> karakter secara acak:<br>`;
  text += `<span style="display:block;margin-top:5px">${names.map((n,i)=>`${i+1}. ${n}`).join(" → ")}</span>`;
  if(home) text += `<br>🏠 Setelah semuanya ditemukan, cari <b>rumah Chocolate Abyss</b>.`;
  missionEl.innerHTML=text;
}
function render(){
  maze.innerHTML="";
  maze.style.gridTemplateColumns=`repeat(${map[0].length},1fr)`;
  const targetMap=new Map(targets.map((p,i)=>[p.x+","+p.y,i]));

  for(let y=0;y<map.length;y++){
    for(let x=0;x<map[y].length;x++){
      const cell=document.createElement("div");
      cell.className="cell"+(map[y][x]==="#"?" wall":"");

      const ti=targetMap.get(x+","+y);
      if(ti!==undefined && ti>=nextTarget){
        cell.classList.add("goal");
        const img=document.createElement("img");
        img.className="target-img";
        img.src=chars[targetOrder[ti]].img;
        img.alt=chars[targetOrder[ti]].name;
        cell.appendChild(img);
      }

      if(home && x===home.x && y===home.y){
        cell.classList.add("goal");
        const img=document.createElement("img");
        img.className="home-img";
        img.src="sources/chocolate-open-gate.png";
        img.alt="Rumah Chocolate Abyss Gate";
        cell.appendChild(img);
      }

      if(x===player.x&&y===player.y){
        const p=document.createElement("div"); p.className="player";
        const img=document.createElement("img");
        img.src=chars[selected].img; img.alt=chars[selected].name;
        p.appendChild(img); cell.appendChild(p);
      }
      maze.appendChild(cell);
    }
  }

  scoreEl.textContent=score;
  stepsEl.textContent=steps;
  totalScoreEl.textContent=totalScore;
  progressEl.innerHTML=targetOrder.map((id,i)=>{
    const c=chars[id];
    return `<div class="dot ${i<nextTarget?"done":i===nextTarget?"now":""}" title="${i+1}. ${c.name}">
      ${i<nextTarget?"✓":`<img src="${c.img}" alt="${c.name}">`}
    </div>`;
  }).join("");

  if(home){
    const dot=document.createElement("div");
    dot.className="dot now";dot.textContent="🏠";dot.title="Cari rumah";
    progressEl.appendChild(dot);
    document.getElementById("caption").textContent="Semua teman ditemukan! Sekarang cari rumah Chocolate Abyss.";
  }else{
    document.getElementById("caption").textContent="Cari teman-temanmu, jawab soal, lalu temukan rumah Chocolate Abyss.";
  }
}

function showToast(msg){
  const t=document.getElementById("toast");
  clearTimeout(toastTimer);t.textContent=msg;t.classList.add("show");
  toastTimer=setTimeout(()=>t.classList.remove("show"),1800);
}

function launchConfetti(){
  const c=document.getElementById("confetti");c.innerHTML="";
  for(let i=0;i<90;i++){
    const p=document.createElement("i");
    p.style.left=Math.random()*100+"%";
    p.style.animationDuration=(2+Math.random()*2.5)+"s";
    p.style.animationDelay=(Math.random()*0.8)+"s";
    p.style.background=["#f3c15b","#e97936","#6da34d","#c9523d","#7b4bd8"][Math.floor(Math.random()*5)];
    p.style.transform=`rotate(${Math.random()*360}deg)`;
    c.appendChild(p);
  }
  setTimeout(()=>c.innerHTML="",5000);
}
