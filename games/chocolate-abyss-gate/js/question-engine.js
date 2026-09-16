// Math question generation and tutor UI

function buildQuestion(){
  const r=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  let a,b,ans,op;
  const i=nextTarget;
  const effectiveDifficulty=adaptiveDifficultyOverride || levelKey;
  if(effectiveDifficulty==="easy"){
    if(i%2===0){a=r(1,9);b=r(1,9);op="+";ans=a+b;}
    else {a=r(3,15);b=r(1,a);op="−";ans=a-b;}
  }else if(effectiveDifficulty==="medium"){
    const t=i%3;
    if(t===0){a=r(5,18);b=r(2,15);op="+";ans=a+b;}
    else if(t===1){a=r(8,25);b=r(1,a);op="−";ans=a-b;}
    else {a=r(2,9);b=r(2,9);op="×";ans=a*b;}
  }else{
    const t=i%4;
    if(t===0){a=r(3,12);b=r(2,10);op="×";ans=a*b;}
    else if(t===1){b=r(2,10);ans=r(2,10);a=b*ans;op="÷";}
    else if(t===2){a=r(15,35);b=r(10,30);op="+";ans=a+b;}
    else {a=r(20,50);b=r(5,a);op="−";ans=a-b;}
  }
  const skill={"+":"addition","−":"subtraction","×":"multiplication","÷":"division"}[op] || op;
  return {a,b,ans,op,skill};
}
function optionsFor(ans){
  const values=new Set([ans]);
  const spread=levelKey==="easy"?5:levelKey==="medium"?10:15;
  const candidates=[];
  for(let d=1;d<=spread;d++){candidates.push(ans+d,ans-d);}
  for(const v of shuffle(candidates)){
    if(v>=0) values.add(v);
    if(values.size===4) break;
  }
  return shuffle([...values]).slice(0,4);
}

function visualItem(src,alt){return `<img class="visual-item" src="${src}" alt="${alt}">`;}
function showVisualTutor(){
  const q=currentQuestion;
  if(!q)return;
  tutorCard.classList.remove("hidden");
  const firstSrc="sources/chocolate-bar.png", secondSrc="sources/chocolate-cupcake.png";
  const op=q.op;
  let left=Math.max(0,q.a), right=Math.max(0,q.b), answer=q.ans;
  let title="Kita hitung bersama 😊", html="", tip="";
  if(op==="+"){
    html=`<div class="visual-title">${left} cokelat + ${right} kue</div><div class="visual-row"><div class="visual-group">${Array.from({length:Math.min(left,12)},()=>visualItem(firstSrc,"cokelat")).join("")}</div><span class="visual-symbol">＋</span><div class="visual-group">${Array.from({length:Math.min(right,12)},()=>visualItem(secondSrc,"kue")).join("")}</div><span class="visual-symbol">＝</span><span class="visual-symbol">?</span></div>`;
    tip=`Hitung jumlah semua benda: ${left} cokelat, lalu tambahkan ${right} kue. Jadi semuanya berjumlah berapa?`;
  }else if(op==="−"){
    html=`<div class="visual-title">${left} cokelat − ${right} yang diambil</div><div class="visual-row"><div class="visual-group">${Array.from({length:Math.min(left,18)},()=>visualItem(firstSrc,"cokelat")).join("")}</div><span class="visual-symbol">−</span><span class="visual-symbol">${right}</span><span class="visual-symbol">＝ ?</span></div>`;
    tip=`Mulai dari ${left}, lalu ambil ${right}. Hitung berapa yang masih tersisa.`;
  }else if(op==="×"){
    html=`<div class="visual-title">${left} kelompok × ${right} benda</div><div class="visual-row">${Array.from({length:Math.min(left,6)},()=>`<div class="visual-group">${Array.from({length:Math.min(right,6)},()=>visualItem(firstSrc,"cokelat")).join("")}</div>`).join('<span class="visual-symbol">＋</span>')}<span class="visual-symbol">＝ ?</span></div>`;
    tip=`Perkalian adalah penjumlahan berulang. Ada ${left} kelompok, masing-masing berisi ${right}.`;
  }else{
    html=`<div class="visual-title">Bagikan ${left} benda menjadi ${right} kelompok</div><div class="visual-row"><div class="visual-group">${Array.from({length:Math.min(left,18)},()=>visualItem(firstSrc,"cokelat")).join("")}</div><span class="visual-symbol">÷</span><span class="visual-symbol">${right}</span><span class="visual-symbol">＝ ?</span></div>`;
    tip=`Coba bagi ${left} benda sama rata ke ${right} kelompok.`;
  }
  tutorMessage.textContent=`Aku lihat jawabanmu belum tepat. ${title}`;
  visualMath.innerHTML=html;
  tutorTip.textContent=tip;
}
function hideVisualTutor(){tutorCard.classList.add("hidden");visualMath.innerHTML="";tutorMessage.textContent="";tutorTip.textContent="";}
function openQuestion(){
  locked=true;
  currentQuestion=buildQuestion();
  currentQuestionId=playerEventTracker.makeQuestionId(levelKey,nextTarget,currentQuestion);
  currentAttemptNumber=0;
  currentHintUsed=false;
  questionShownAt=Date.now();
  const profile=getPlayerLearningProfile();
  profile.currentSkill=currentQuestion.skill;
  profile.currentDifficulty=levelKey;
  lastAIDecision=requestAIDecision(profile);
  adaptiveDifficultyOverride=lastAIDecision.skill===currentQuestion.skill ? lastAIDecision.difficulty : null;
  playerEventTracker.track("QUESTION_SHOWN", {
    questionId:currentQuestionId,
    question:`${currentQuestion.a} ${currentQuestion.op} ${currentQuestion.b} = ?`,
    skill:getCurrentSkill(),
    difficulty:adaptiveDifficultyOverride || levelKey,
    timestamp:new Date().toISOString()
  });
  updateDebugPanel();
  const targetName=chars[targetOrder[nextTarget]].name;
  document.getElementById("questionImg").src=chars[targetOrder[nextTarget]].img;
  document.getElementById("questionTitle").textContent=`Misi ${nextTarget+1} • ${targetName}`;
  document.getElementById("questionText").textContent=`${currentQuestion.a} ${currentQuestion.op} ${currentQuestion.b} = ?`;
  document.getElementById("feedback").textContent="";
  hideVisualTutor();
  const aiNote=document.getElementById("aiNote");
  aiNote.classList.add("hidden");
  aiNote.textContent="";
  const answers=document.getElementById("answers");
  answers.innerHTML="";
  optionsFor(currentQuestion.ans).forEach(v=>{
    const b=document.createElement("button");
    b.textContent=v;
    b.onclick=()=>answerQuestion(v);
    answers.appendChild(b);
  });
  questionModal.classList.add("show");
}

function answerQuestion(value){
  const f=document.getElementById("feedback");
  currentAttemptNumber++;
  const responseTime=Math.max(0,Date.now()-(questionShownAt || Date.now()));
  const answerEvent={
    questionId:currentQuestionId,
    playerAnswer:value,
    correctAnswer:currentQuestion.ans,
    isCorrect:value===currentQuestion.ans,
    responseTime,
    attemptNumber:currentAttemptNumber,
    hintUsed:currentHintUsed
  };
  playerEventTracker.track("ANSWER_SUBMITTED", answerEvent);
  updateDebugPanel();
  if(value!==currentQuestion.ans){
    score=Math.max(0,score-25);
    totalScore=Math.max(0,totalScore-25);
    const profile=getPlayerLearningProfile();
    profile.currentSkill=currentQuestion.skill;
    profile.currentDifficulty=levelKey;
    lastAIDecision=requestAIDecision(profile);
    currentHintUsed=true;
    // Setiap jawaban salah selalu membuka Chocolate Guide di sisi soal.
    // AI/adaptive decision memilih bentuk bantuan dan tingkat kesulitan berikutnya.
    showVisualTutor();
    const hintMap={addition:"Coba hitung dari angka pertama, lalu tambahkan angka kedua satu per satu.",subtraction:"Mulai dari jumlah awal, lalu ambil benda satu per satu.",multiplication:"Ingat: perkalian adalah penjumlahan berulang. Hitung setiap kelompok.",division:"Bagikan benda satu per satu ke setiap kelompok sampai semuanya habis."};
    const hint=hintMap[currentQuestion.skill] || "Coba perhatikan kembali benda dan tanda operasinya.";
    aiNote.textContent=`Chocolate Guide: ${hint}`;
    aiNote.classList.remove("hidden");
    tutorMessage.textContent=`Belum tepat, tidak apa-apa 😊 Yuk kita hitung bersama!`;
    f.textContent=`❌ Belum tepat. -25 poin. ${lastAIDecision.action === "REMEDIATE" ? "Aku akan bantu dengan soal yang lebih mudah." : "Lihat bantuan Chocolate Guide di samping."}`;
    playerEventTracker.track("HINT_USED",{questionId:currentQuestionId,hintLevel:lastAIDecision.action||"SUPPORT",skill:currentQuestion.skill});
    if(lastAIDecision.difficulty && lastAIDecision.difficulty!==levelKey){
      adaptiveDifficultyOverride=lastAIDecision.difficulty;
    }
    updateDebugPanel();
    render();
    return;
  }
  const actual=steps-missionStartSteps;
  const optimal=distanceMap(missionStart).get(player.x+","+player.y) ?? actual;
  const extra=Math.max(0,actual-optimal);
  const bonus=Math.max(20,100-extra*5);
  const earned=100+bonus;
  score+=earned;
  totalScore+=earned;
  hideVisualTutor();
  f.innerHTML=`🎉 Benar! <b>+${earned} poin</b><br><small>Rute ${actual} langkah • rute tercepat ${optimal}</small>`;
  playerEventTracker.track("QUESTION_COMPLETED", {
    questionId:currentQuestionId,
    question:`${currentQuestion.a} ${currentQuestion.op} ${currentQuestion.b} = ?`,
    skill:getCurrentSkill(),
    responseTime,
    attemptNumber:currentAttemptNumber,
    hintUsed:currentHintUsed
  });
  nextTarget++;
  missionStart={...player}; missionStartSteps=steps;
  render();

  setTimeout(()=>{
    questionModal.classList.remove("show");
    if(nextTarget===targetOrder.length){
      home=chooseHome();
      updateMission();
      locked=false;
      updateNewMazeButton();
      render();
      showToast("🏠 Semua teman ditemukan! Cari rumah Chocolate Abyss.");
    }else{
      locked=false;
    }
  },750);
}

