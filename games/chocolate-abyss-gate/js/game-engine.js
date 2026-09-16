// Main game state, level lifecycle, movement and event wiring

const chars = [
  {name:"Cokelat Batang", img:"sources/chocolate-bar.png"},
  {name:"Kuki Cokelat", img:"sources/kuki-cokelat.png"},
  {name:"Kopi", img:"sources/kopi.png"},
  {name:"Pretzel", img:"sources/pretzel.png"},
  {name:"Croissant", img:"sources/croissant.png"}
];

const levels = {
  easy:   {name:"Mudah", size:15, loops:3, desc:"Tambah & kurang • maze sederhana"},
  medium: {name:"Sedang", size:21, loops:15, desc:"Tambah, kurang & perkalian • banyak percabangan"},
  hard:   {name:"Sulit", size:27, loops:32, desc:"Operasi campuran • banyak rute & kejar waktu"}
};

const STORAGE = "sugaria_chocolate_abyss_progress_v16";
let unlocked = Number(localStorage.getItem(STORAGE) || 1);
if (!Number.isFinite(unlocked) || unlocked < 1 || unlocked > 3) unlocked = 1;

let selected = 0;
let levelKey = "easy";
let map = [];
let player = {x:1,y:1};
let targets = [];
let targetSlots = [];
let targetOrder = [];
let nextTarget = 0;
let home = null;
let score = 0;
let totalScore = 0;
let steps = 0;
let locked = true;
let gameStarted = false;
let missionStart = {x:1,y:1};
let missionStartSteps = 0;
let currentQuestion = null;
let toastTimer = null;

const DEBUG_MODE = true;

// AI HackFest 2026 tracking integration. Gameplay state remains unchanged.
const playerEventTracker = new PlayerEventTracker({ storageKey: "chocolateAbyssPlayerData" });
window.playerEventTracker = playerEventTracker;
window.getCurrentGameLevel = () => levelKey;
let questionShownAt = null;
let currentQuestionId = null;
let currentAttemptNumber = 0;
let currentHintUsed = false;
let lastAIDecision = null;
let adaptiveDifficultyOverride = null;

function levelIndex(k){return k==="easy"?1:k==="medium"?2:3;}
function keyFromIndex(i){return i===1?"easy":i===2?"medium":"hard";}
function updateNewMazeButton(){
  const btn=document.getElementById("newMaze");
  // Selalu aktif. Pemain dapat membuat labirin baru berkali-kali tanpa
  // menghapus riwayat tracking atau progress level.
  btn.disabled = false;
  btn.title = "Buat labirin baru";
}

function setupLevel(){
  const cfg=levels[levelKey];
  const seed=Date.now()+Math.floor(Math.random()*1000000);
  const rng=seededRandom(seed);
  map = levelKey==="medium" ? mediumMap.map(r=>r) : generateMaze(cfg.size,seed,cfg.loops);

  player={x:1,y:1};
  // Always start on a walkable cell. This prevents a newly generated maze from spawning inside a wall.
  if(map[player.y]?.[player.x]==="#") player=findNearestWalkable(player.x,player.y);
  prepareTargets(rng);
  score=0;
  steps=0;
  missionStart={...player};
  missionStartSteps=0;
  locked=true;
  gameStarted=false;
  updateNewMazeButton();

  levelHint.innerHTML = `<b>${cfg.name}</b> — ${cfg.desc}<br>
    Jawaban benar <b>+100</b> + bonus rute. Jawaban salah <b>-25</b>.`;
  updateDifficulty();
  updateMission();
  render();
  showIntro();
}
function startLevelWithoutIntro(){
  playerEventTracker.track("LEVEL_STARTED", {level:levelKey,difficulty:levelKey});
  updateDebugPanel();
  /* Used for the automatic Easy → Medium → Hard transition. */
  gameStarted=true;
  locked=false;
  hideStart();
  updateDifficulty();
  updateNewMazeButton();
  render();
}
function startNewSession(){
  totalScore=0;
  levelKey="easy";
  selected=0;
  unlocked=1;
  localStorage.setItem(STORAGE,"1");
  gameStarted=false;
  locked=true;
  adaptiveDifficultyOverride=null;
  lastAIDecision=null;
  setupLevel();
  showIntro();
}
function move(dx,dy){
  // Movement is allowed only after the player has started the current level.
  // Keep this independent from overlay animations/classes so keyboard and touch controls behave identically.
  if(!gameStarted || locked || !startOverlay.classList.contains("hidden") || questionModal.classList.contains("show") || levelModal.classList.contains("show") || !finalOverlay.classList.contains("hidden")) return;
  const nx=player.x+dx, ny=player.y+dy;
  if(!Number.isInteger(nx)||!Number.isInteger(ny)) return;
  if(nx<0||ny<0||ny>=map.length||nx>=map[0].length||map[ny][nx]==="#") return;
  player={x:nx,y:ny};
  steps++;
  render();

  const ti=targets.findIndex(p=>p.x===nx&&p.y===ny);
  if(!home && ti===nextTarget) openQuestion();
  else if(!home && ti>nextTarget) showToast(`🔎 Temukan ${chars[targetOrder[nextTarget]].name} lebih dulu.`);
  else if(home && nx===home.x && ny===home.y) completeLevel();
}

function completeLevel(){
  locked=true;
  const profile=getPlayerLearningProfile();
  const levelEvents=playerEventTracker.getEvents().filter(e=>e.type==="ANSWER_SUBMITTED" && e.level===levelKey);
  const correctAnswers=levelEvents.filter(e=>e.isCorrect).length;
  const incorrectAnswers=levelEvents.filter(e=>!e.isCorrect).length;
  const responseTimes=levelEvents.map(e=>Number(e.responseTime)).filter(Number.isFinite);
  playerEventTracker.track("LEVEL_COMPLETED", {
    level:levelKey, difficulty:levelKey, accuracy:(correctAnswers+incorrectAnswers)?correctAnswers/(correctAnswers+incorrectAnswers):0,
    averageResponseTime:responseTimes.length?responseTimes.reduce((a,b)=>a+b,0)/responseTimes.length:0,
    totalQuestions:correctAnswers+incorrectAnswers, correctAnswers, incorrectAnswers, hintsUsed:profile.hintsUsed
  });
  updateDebugPanel();
  const idx=levelIndex(levelKey);
  if(idx<3){
    unlocked=idx+1;
    localStorage.setItem(STORAGE,String(unlocked));
    document.getElementById("levelTitle").textContent=`🎉 ${levels[levelKey].name} selesai!`;
    document.getElementById("levelMessage").innerHTML=
      `Skor level <b>${score}</b> • <b>${steps}</b> langkah<br>🏆 Total skor <b>${totalScore}</b><br><br>
       🔓 <b>${levels[keyFromIndex(idx+1)].name}</b> terbuka.<br>
       Petualangan langsung berlanjut tanpa intro dan tanpa memilih karakter lagi.`;
    const buttons=document.getElementById("levelButtons");
    const nextKey=keyFromIndex(idx+1);
    buttons.innerHTML=`
      <button id="replayMazeBtn">🔄 Labirin Baru</button>
      <button id="nextLevelBtn">🚀 Lanjut ke ${levels[nextKey].name}</button>
    `;

    // Setelah satu tingkat selesai, pemain boleh mengulang tingkat yang sama
    // dengan labirin baru ATAU langsung melanjutkan ke tingkat berikutnya.
    document.getElementById("replayMazeBtn").onclick=()=>{
      levelModal.classList.remove("show");
      setupLevel();
      startLevelWithoutIntro();
      updateNewMazeButton();
      showToast(`🔄 Labirin ${levels[levelKey].name} baru dimulai!`);
    };

    document.getElementById("nextLevelBtn").onclick=()=>{
      levelKey=nextKey;
      levelModal.classList.remove("show");
      setupLevel();
      startLevelWithoutIntro();
      updateNewMazeButton();
    };

    // Tombol Labirin Baru di header juga sudah aktif setelah rumah ditemukan.
    // Pastikan statusnya diperbarui saat dialog selesai ditampilkan.
    updateNewMazeButton();
    levelModal.classList.add("show");
  }else{
    playerEventTracker.track("GAME_COMPLETED", {level:levelKey, difficulty:levelKey, totalScore});
    setCupcakeEmotion(
   "victory",
   "🏆 Hebat! Kamu berhasil menaklukkan Chocolate Abyss Gate!"
);
    updateDebugPanel();
    launchConfetti();
    document.getElementById("finalMessage").innerHTML=
      `Semua tingkat Chocolate Abyss Gate berhasil ditaklukkan!<br>
       Skor akumulasi Easy + Medium + Hard: <b>${totalScore}</b><br>Skor Hard: <b>${score}</b> dengan <b>${steps}</b> langkah.<br><br>
       🏆 Piala menunggu sang petualang hebat!`;
    finalOverlay.classList.remove("hidden");
  }
}

function exitGame(){
  // EXIT hanya keluar dari sesi aktif. Riwayat event dan level unlock
  // tetap tersimpan di localStorage.
  locked=true;
  gameStarted=false;
  questionModal.classList.remove("show");
  levelModal.classList.remove("show");
  finalOverlay.classList.add("hidden");
  adaptiveDifficultyOverride=null;
  lastAIDecision=null;
  currentQuestion=null;
  currentQuestionId=null;
  currentAttemptNumber=0;
  currentHintUsed=false;

  // Kembali ke halaman awal tanpa menghapus riwayat.
  levelKey="easy";
  selected=0;
  setupLevel();
  showIntro();
  updateDifficulty();
  updateNewMazeButton();
  updateDebugPanel();
  showToast("🚪 Keluar dari game. Riwayat permainan tetap tersimpan.");
}

document.getElementById("goPick").onclick=showProfile;
document.getElementById("backIntroFromProfile").onclick=showIntro;
function savePlayerProfileFromForm(){
  const name=String(document.getElementById("playerName").value||"").trim().replace(/\s+/g," ");
  const ageValue=String(document.getElementById("playerAge").value||"").trim();
  const age=Number(ageValue);
  if(name.length<2){showToast("✏️ Masukkan nama panggilan minimal 2 karakter.");document.getElementById("playerName").focus();return false;}
  if(!/^\d+$/.test(ageValue)||!Number.isInteger(age)||age<4||age>18){showToast("🎂 Masukkan usia antara 4–18 tahun.");document.getElementById("playerAge").focus();return false;}
  playerEventTracker.setPlayerInfo(name,age);
  updateDebugPanel();
  showPicker();
  return false;
}
document.getElementById("saveProfile").onclick=savePlayerProfileFromForm;
document.getElementById("playerName").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();document.getElementById("playerAge").focus();}});
document.getElementById("playerAge").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();savePlayerProfileFromForm();}});
document.getElementById("backIntro").onclick=showProfile;
document.getElementById("startGame").onclick=()=>{
  // Karakter baru dipilih setelah setup awal. Siapkan ulang misi SEKALI
  // agar karakter pemain tidak pernah muncul sebagai target.
  const seed=Date.now()+Math.floor(Math.random()*1000000);
  prepareTargets(seededRandom(seed));
  score=0;
  steps=0;
  missionStart={...player};
  missionStartSteps=0;
  locked=false;
  gameStarted=true;
  adaptiveDifficultyOverride=null;
  lastAIDecision=null;
  playerEventTracker.startSession();
  playerEventTracker.track("GAME_STARTED", {playerName:playerEventTracker.getPlayerInfo().name,playerAge:playerEventTracker.getPlayerInfo().age});
  playerEventTracker.track("LEVEL_STARTED", {level:levelKey,difficulty:levelKey});
  hideStart();
  setCupcakeEmotion(
   "welcome",
   `Halo ${
      playerEventTracker
      .getPlayerInfo()
      .name || "teman"
   }! Aku akan menemanimu hari ini. 🍫`
);
  updateMission();
  updateDifficulty();
  updateNewMazeButton();
  render();
};
document.getElementById("newMaze").onclick=()=>{
  // Regenerasi penuh tanpa kembali ke intro. Karakter, level unlock,
  // dan riwayat player-event-tracker tetap dipertahankan.
  if(questionModal.classList.contains("show") || levelModal.classList.contains("show") || !finalOverlay.classList.contains("hidden")) return;
  adaptiveDifficultyOverride=null;
  lastAIDecision=null;
  setupLevel();
  startLevelWithoutIntro();
  showToast(`🆕 Labirin ${levels[levelKey].name} baru! Posisi karakter diacak.`);
};
document.getElementById("exitGame").onclick=exitGame;
document.getElementById("playAgain").onclick=()=>{
  finalOverlay.classList.add("hidden");
  startNewSession();
};
document.getElementById("finalExit").onclick=exitGame;

document.querySelectorAll("#difficulty button").forEach(btn=>{
  btn.onclick=()=>{
    const idx=levelIndex(btn.dataset.level);
    if(idx>unlocked){showToast("🔒 Selesaikan tingkat sebelumnya terlebih dahulu.");return;}
    if(gameStarted && btn.dataset.level!==levelKey){showToast("Selesaikan level yang sedang dimainkan terlebih dahulu.");return;}
    levelKey=btn.dataset.level;
    setupLevel();
    startLevelWithoutIntro();
  };
});
document.querySelectorAll(".controls button").forEach(btn=>{
  const handler=(e)=>{ e.preventDefault(); const [x,y]=btn.dataset.move.split(",").map(Number); move(x,y); };
  btn.addEventListener("click",handler);
  btn.addEventListener("pointerdown",e=>e.preventDefault());
});
document.addEventListener("keydown",e=>{
  // Jangan intercept keyboard saat sedang mengetik nama/teks.
  const target=e.target;
  if(target && (target.matches("input, textarea, select") || target.isContentEditable)) return;

  const key=e.key.toLowerCase();
  const d={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]}[key];
  if(d){e.preventDefault();move(...d);}
});

document.getElementById("exportPlayerData").onclick=()=>playerEventTracker.exportJSON();
document.getElementById("clearPlayerData").onclick=()=>{
  if(confirm("Hapus seluruh data tracking pemain? Progres game juga tidak diubah.")){
    playerEventTracker.clearPlayerData();
    updateDebugPanel();
    showToast("🗑️ Player tracking data dihapus.");
  }
};
window.addEventListener(
 "player-event",
 () => {
   updateDebugPanel();
   const profile =
      getPlayerLearningProfile();
   const decision =
      requestAIDecision(
         profile
      );
   lastAIDecision =
      decision;
   if(
      typeof setCupcakeEmotion ===
      "function"
   ){
      setCupcakeEmotion(
         decision.emotion,
         decision.speech
      );
   }
 }
);
updateHeaderCharacters();
setupLevel();
updateDebugPanel();

