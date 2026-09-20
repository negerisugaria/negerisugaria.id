(function(){

  const CUPCAKE_API =
    "https://api.negerisugaria.id/api/cupcake/respond";

  /*
   * ============================================================
   * LOCAL ADAPTIVE DECISION
   * ============================================================
   *
   * Fungsi ini sengaja tetap synchronous karena index.html
   * menggunakan:
   *
   * lastAIDecision = requestAIDecision(profile);
   *
   * Jangan mengubah fungsi ini menjadi async.
   */
  window.requestAIDecision = function(playerProfile){

    const skill =
      playerProfile.currentSkill ||
      Object.keys(playerProfile.skills || {})[0] ||
      "addition";

    const skillData =
      (playerProfile.skills || {})[skill] || {};

    const recent =
      (playerProfile.recentPerformance || [])
        .filter(e => e.skill === skill)
        .slice(-3);

    const recentMistakes =
      recent.filter(e => !e.isCorrect).length;

    const accuracy =
      Number.isFinite(skillData.accuracy)
        ? skillData.accuracy
        : Number(playerProfile.accuracy || 0);

    const slow =
      Number(playerProfile.averageResponseTime || 0) > 7000;

    const totalAttempts =
      Number(playerProfile.attempts || 0);

    let decision;

    if(totalAttempts === 0){

      decision = {
        action: "BASELINE",
        difficulty:
          playerProfile.currentDifficulty || "easy",
        skill,
        useHint: false,
        reason: "no_history"
      };

    }else if(recentMistakes >= 2 || accuracy < 0.5){

      decision = {
        action: "REMEDIATE",
        difficulty: "easy",
        skill,
        useHint: true,
        reason: "repeated_mistakes"
      };

    }else if(recentMistakes >= 1 || accuracy < 0.7 || slow){

      decision = {
        action: "SUPPORT",
        difficulty: "easy",
        skill,
        useHint: true,
        reason: "needs_support"
      };

    }else{

      decision = {
        action: "PRACTICE",
        difficulty:
          playerProfile.currentDifficulty || "medium",
        skill,
        useHint: false,
        reason: "continue_practice"
      };

    }

    return decision;
  };


  /*
   * ============================================================
   * CHOCOLATE CUPCAKE AI API
   * ============================================================
   */

  const CUPCAKE_API_TIMEOUT = 8000;

  window.requestCupcakeResponse = async function(eventData){

    const controller = new AbortController();

    const timeoutId = setTimeout(
      () => controller.abort(),
      CUPCAKE_API_TIMEOUT
    );

    try{

      const response = await fetch(CUPCAKE_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(eventData),
        signal: controller.signal
      });

      if(!response.ok){
        throw new Error(
          "Cupcake API HTTP " + response.status
        );
      }

      const data = await response.json();

      if(!data || !data.success){
        throw new Error("Invalid Cupcake API response");
      }

      return data;

    }catch(error){

      const message =
        error && error.name === "AbortError"
          ? "Cupcake API timeout"
          : (error && error.message) || "Unknown API error";

      console.warn(
        "[Chocolate Cupcake] API unavailable:",
        message
      );

      return {
        success: false,
        fallback: true,
        response: null,
        error: message
      };

    }finally{

      clearTimeout(timeoutId);

    }

  };


  /*
   * ============================================================
   * DISPLAY CHOCOLATE CUPCAKE RESPONSE
   * ============================================================
   */

 const stateImages = {
    welcome: "sources/welcome.png",
    encouraging: "sources/encouraging.png",
    thinking: "sources/thinking.png",
    oops: "sources/oops.png",
    teaching: "sources/theaching.png",
    celebrating: "sources/celebrating.png",
    victory: "sources/victory.png"
  };

  function normalizeCupcakeState(state){

    const value =
      String(state || "encouraging")
        .toLowerCase()
        .trim();

    return stateImages[value]
      ? value
      : "encouraging";

  }

  function speakCupcake(message){

    if(
      !message ||
      !("speechSynthesis" in window)
    ){
      return;
    }

    try{

      // Satu pesan AI = satu suara. Jangan membuat antrean TTS.
      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(message);

      utterance.lang = "id-ID";
      utterance.rate = 0.95;
      utterance.pitch = 1.05;

      window.speechSynthesis.speak(utterance);

    }catch(error){

      console.warn(
        "[Chocolate Cupcake] TTS error:",
        error
      );

    }

  }

  function buildOneStepMathVisual(math){

    if(!math || !Number.isFinite(Number(math.a)) || !Number.isFinite(Number(math.b))){
      return null;
    }

    const a=Math.max(0,Math.floor(Number(math.a)));
    const b=Math.max(0,Math.floor(Number(math.b)));
    const op=String(math.op || "+");
    const answer=Number(math.answer);

    const box=document.createElement("div");
    box.className="cupcake-math-one-step";

    const expression=document.createElement("div");
    expression.className="cupcake-math-expression";
    expression.textContent=`${a} ${op} ${b} = ?`;
    box.appendChild(expression);

    const row=document.createElement("div");
    row.className="cupcake-math-row";

    const left=document.createElement("div");
    left.className="cupcake-math-group";
    left.textContent="🍫".repeat(Math.min(a,20));
    row.appendChild(left);

    const symbol=document.createElement("div");
    symbol.className="cupcake-math-symbol";
    symbol.textContent=op;
    row.appendChild(symbol);

    const right=document.createElement("div");
    right.className="cupcake-math-group";
    right.textContent="🍫".repeat(Math.min(b,20));
    row.appendChild(right);

    box.appendChild(row);

    const result=document.createElement("div");
    result.className="cupcake-math-result";

    if(op==="−" || op==="-"){
      result.textContent=`Ambil ${b} 🍫 dari ${a} 🍫 → tersisa ${Number.isFinite(answer)?answer:a-b} 🍫`;
    }else if(op==="+"){
      result.textContent=`Gabungkan semuanya → ${Number.isFinite(answer)?answer:a+b} 🍫`;
    }else if(op==="×"){
      result.textContent=`${a} kelompok × ${b} → ${Number.isFinite(answer)?answer:a*b} 🍫`;
    }else if(op==="÷"){
      result.textContent=`Bagikan ${a} 🍫 ke ${b} kelompok → ${Number.isFinite(answer)?answer:a/b} 🍫 per kelompok`;
    }else{
      result.textContent=`Hasilnya ${Number.isFinite(answer)?answer:"?"}`;
    }

    box.appendChild(result);
    return box;
  }

  function showCupcakeResponse(
    data,
    options = {}
  ){

    if(!data || !data.success || !data.response){
      return;
    }

    const ai = data.response;

    const note =
      document.getElementById("aiNote");

    if(!note){
      console.warn(
        "[Chocolate Cupcake] #aiNote tidak ditemukan."
      );
      return;
    }

    const state =
      normalizeCupcakeState(
        ai.state || ai.emotion
      );

    const imageSrc =
      stateImages[state];

    let message =
      String(ai.message || "").trim();

    if(ai.hint){

      const hint =
        String(ai.hint).trim();

      if(hint && !message.includes(hint)){
        message +=
          (message ? " " : "") + hint;
      }

    }

    note.innerHTML = "";

    const wrapper =
      document.createElement("div");

    wrapper.className =
      "cupcake-ai-response";

    const image =
      document.createElement("img");

    image.className =
      "cupcake-ai-image";

    image.src = imageSrc;
    image.alt = "Chocolate Cupcake";
    image.loading = "eager";

    image.onerror = function(){

      console.warn(
        "[Chocolate Cupcake] Asset tidak ditemukan:",
        imageSrc
      );

    };

    const content =
      document.createElement("div");

    content.className =
      "cupcake-ai-content";

    const title =
      document.createElement("strong");

    title.textContent =
      "🍫 Chocolate Cupcake";

    const textElement =
      document.createElement("div");

    textElement.className =
      "cupcake-ai-message";

    textElement.textContent =
      message;

    content.appendChild(title);
    content.appendChild(textElement);

    if(
      ai.visual &&
      ai.visual.enabled
    ){

      const mathVisual =
        buildOneStepMathVisual(ai.visual.math);

      if(mathVisual){
        content.appendChild(mathVisual);
      }else if(ai.visual.content){
        const visual=document.createElement("div");
        visual.className="cupcake-ai-visual";
        visual.textContent=String(ai.visual.content);
        content.appendChild(visual);
      }

    }

    wrapper.appendChild(image);
    wrapper.appendChild(content);

    note.appendChild(wrapper);
    note.classList.remove("hidden");

    /*
     * TTS hanya untuk feedback lokal. Respons AI asynchronous
     * tidak boleh berbicara ulang ketika datang terlambat.
     */
    if(
      options.speak === true &&
      ai.speak === true &&
      ai.message
    ){

      speakCupcake(ai.message);

    }

    if(
      state === "celebrating" ||
      state === "victory"
    ){

      if(window.cupcakeCelebrationTimer){
        clearTimeout(
          window.cupcakeCelebrationTimer
        );
      }

      const duration =
        state === "victory"
          ? 10000
          : 5000;

      window.cupcakeCelebrationTimer =
        setTimeout(() => {

          if(note){
            note.classList.remove("hidden");
          }

        }, duration);

    }

  }


  /*
   * ============================================================
   * SEND GAME EVENT TO CUPCAKE AI
   * ============================================================
   */

  let cupcakeRequestSequence = 0;

  function nextCupcakeRequestId(){

    cupcakeRequestSequence += 1;

    return cupcakeRequestSequence;

  }

  window.sendCupcakeEvent = function(eventData){

    const requestId =
      nextCupcakeRequestId();

    requestCupcakeResponse(eventData)
      .then(data => {

        /*
         * Response lama tidak boleh menimpa event yang lebih baru.
         */
        if(requestId !== cupcakeRequestSequence){
          return;
        }

        /*
         * AI hanya memperkaya pesan/visual. State game dan
         * TTS sudah ditangani oleh feedback lokal.
         */
        /*
         * Untuk event game, UI sudah ditentukan oleh game engine.
         * Response model tetap diproses server untuk AI/learning,
         * tetapi tidak boleh mengganti feedback lokal setelah
         * menunggu beberapa detik.
         */
        if(
          data &&
          data.success &&
          eventData &&
          eventData.event === "tutor_request"
        ){

          showCupcakeResponse(
            data,
            { speak: false }
          );

        }

      })
      .catch(error => {

        console.warn(
          "[Chocolate Cupcake] Event error:",
          error
        );

      });

    return requestId;

  };


  /*
   * ============================================================
   * LOCAL GAME FEEDBACK
   * ============================================================
   */

  function showLocalCupcakeState({
    state,
    message,
    hint = "",
    visual = "",
    speak = true
  }){

    showCupcakeResponse({

      success: true,

      response: {
        state,
        message,
        hint,

        visual: {
          enabled: Boolean(visual),
          content: visual
        },

        speak,
        emotion: state
      }

    }, {
      speak
    });

  }

  function localAnswerFeedback({
    isCorrect,
    attemptNumber,
    question,
    decision
  }){

    const info =
      window.playerEventTracker?.getPlayerInfo
        ? window.playerEventTracker.getPlayerInfo()
        : {};

    const playerName =
      String(info.name || "Petualang").trim();

    const a = Number(question?.a);
    const b = Number(question?.b);
    const op = question?.op || "+";
    const answer = Number(question?.ans);
    const validMath =
      Number.isFinite(a) && Number.isFinite(b);

    const visual = validMath
      ? { enabled:true, math:{a,b,op,answer} }
      : { enabled:false };

    if(isCorrect === true){

      showLocalCupcakeState({
        state: "celebrating",
        message: `Bagus sekali, ${playerName}! Jawabanmu benar! 🎉🍫`,
        visual: { enabled:true, content:"🎉 +1 jawaban benar" },
        speak: true
      });

      return;
    }

    const attempt = Number(attemptNumber || 1);

    let state = attempt === 1 ? "encouraging" : "teaching";
    let message = attempt === 1
      ? `Tidak apa-apa, ${playerName}. Yuk coba lagi! Kamu pasti bisa! 💪`
      : `${playerName}, ayo kita hitung bersama. Aku bantu satu langkah saja. 🧠`;

    if(decision?.difficulty && decision.difficulty !== decision.currentDifficulty){
      const current = String(decision.currentDifficulty || "").toLowerCase();
      const next = String(decision.difficulty || "").toLowerCase();
      if(current && next && current !== next){
        message += next === "easy"
          ? " Aku menurunkan tingkat kesulitan agar kamu lebih nyaman belajar."
          : " Aku menaikkan tantangan karena performamu meningkat.";
      }
    }

    const why =
      decision?.reason === "repeated_mistakes"
        ? `Alasanku: kamu mengalami beberapa kesalahan pada ${question?.skill || "soal ini"}.`
        : decision?.reason === "needs_support"
          ? `Alasanku: aku melihat kamu masih perlu sedikit bantuan pada ${question?.skill || "soal ini"}.`
          : "Alasanku: aku ingin membantu kamu menyelesaikan soal ini.";

    showLocalCupcakeState({
      state,
      message,
      hint: attempt >= 2 ? why : "Coba hitung pelan-pelan.",
      visual,
      speak: true
    });
  }


  /*
   * ============================================================
   * HELPER: BUILD ANSWER EVENT
   * ============================================================
   */

  window.askCupcakeAfterAnswer = function({

    question,
    playerAnswer,
    correctAnswer,
    isCorrect,
    attemptNumber,
    responseTime,
    skill,
    difficulty,
    playerId

  }){

    /*
     * Feedback langsung. Game tidak menunggu model.
     */
    localAnswerFeedback({
      isCorrect,
      attemptNumber,
      question,
      decision: window.currentAIDecision || null
    });

    /*
     * AI berjalan asynchronous untuk tutor/learning profile.
     */
    window.sendCupcakeEvent({

      event: "answer_submitted",

      player: {
        id: playerId || "player"
      },

      game: {
        gameId: "chocolate-abyss-gate",
        level: difficulty || "easy"
      },

      question: {

        type:
          skill || "addition",

        a:
          question?.a,

        b:
          question?.b,

        operation:
          question?.op,

        correctAnswer

      },

      answer: {

        value:
          playerAnswer,

        correct:
          isCorrect

      },

      attempt:
        Number(attemptNumber || 1),

      context: {

        responseTime:
          Number(responseTime || 0),

        skill:
          skill || "addition"

      }

    });

  };


  /*
   * ============================================================
   * WELCOME
   * ============================================================
   */

  window.startCupcakeWelcome = function(playerId){

    /*
     * Welcome tampil langsung. AI tetap dipanggil di background.
     */
    showLocalCupcakeState({

      state: "welcome",

      message:
        "Halo! Aku Chocolate Cupcake. Yuk kita mulai petualangan! 🍫✨",

      visual:
        "🍫🧁",

      speak: true

    });

    window.sendCupcakeEvent({

      event: "game_started",

      player: {
        id: playerId || "player"
      },

      game: {

        gameId:
          "chocolate-abyss-gate",

        level:
          window.getCurrentGameLevel
            ? window.getCurrentGameLevel()
            : "easy"

      }

    });

  };


  /*
   * ============================================================
   * VICTORY
   * ============================================================
   */

  window.sendCupcakeVictory = function({

    playerId,
    level,
    correct,
    wrong

  }){

    const levelKey =
      String(level || "easy")
        .toLowerCase();

    const isFinalVictory =
      levelKey === "hard";

    /*
     * Feedback level/final tampil langsung.
     */
    if(isFinalVictory){

      showLocalCupcakeState({

        state: "victory",

        message:
          "Luar biasa! Kamu berhasil menyelesaikan Chocolate Abyss Gate! 🏆🍫🎉",

        visual:
          "🏆🎉🍫",

        speak: true

      });

    }else{

      showLocalCupcakeState({

        state: "celebrating",

        message:
          "Hebat! Level ini selesai! 🎉🍫",

        visual:
          "🎉🍫",

        speak: true

      });

    }

    /*
     * Event tetap dikirim untuk AI/learning profile.
     */
    window.sendCupcakeEvent({

      event:
        "level_completed",

      player: {

        id:
          playerId || "player"

      },

      game: {

        gameId:
          "chocolate-abyss-gate",

        level:
          level || "easy"

      },

      progress: {

        correct:
          Number(correct || 0),

        wrong:
          Number(wrong || 0),

        completed:
          true,

        finalVictory:
          isFinalVictory

      }

    });

  };


})();
