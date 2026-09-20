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

  function escapeHtml(value){
    return String(value).replace(/[&<>\"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;","'":"&#39;"}[c];
    });
  }

  /* Visual matematika satu langkah, ramah anak. */
  function formatVisualMath(value){
    if(value === null || value === undefined) return "";
    if(typeof value === "string" || typeof value === "number") return escapeHtml(String(value));
    if(Array.isArray(value)) return value.map(formatVisualMath).join(" ");
    if(typeof value === "object"){
      if(value.display !== undefined) return formatVisualMath(value.display);
      if(value.text !== undefined) return formatVisualMath(value.text);
      if(value.equation !== undefined) return formatVisualMath(value.equation);
      if(value.expression !== undefined) return formatVisualMath(value.expression);
      if(value.a !== undefined && value.b !== undefined){
        const op = value.operation || value.op || "+";
        const answer = value.answer !== undefined ? " = " + value.answer : " = ?";
        return buildChildVisual(value.a, op, value.b, answer);
      }
      return Object.entries(value).map(function(pair){
        return "<div>" + escapeHtml(pair[0]) + ": " + formatVisualMath(pair[1]) + "</div>";
      }).join("");
    }
    return escapeHtml(String(value));
  }

  function buildObjectGroup(count, icon, taken){
    const n = Math.max(0, Math.min(20, Math.floor(Number(count) || 0)));
    const t = Math.max(0, Math.min(n, Math.floor(Number(taken) || 0)));
    let html = '<span class="math-object-group" aria-label="' + n + ' benda">';
    for(let i=0;i<n;i++){
      html += '<span class="math-object' + (i < t ? ' taken' : '') + '">' + icon + '</span>';
    }
    html += '</span>';
    return html;
  }

  function buildChildVisual(a, op, b, suffix){
    const n1 = Math.max(0, Math.min(20, Math.floor(Number(a))));
    const n2 = Math.max(0, Math.min(20, Math.floor(Number(b))));
    if(!Number.isFinite(n1) || !Number.isFinite(n2)){
      return '<div class="math-visual-label">' + escapeHtml(String(a) + ' ' + op + ' ' + String(b) + suffix) + '</div>';
    }

    const operation = String(op).replace('*','×');
    let html = '<div class="math-visual-label">Mari kita lihat bendanya:</div>';

    if(operation === '+'){
      html += '<div class="math-visual-row">' +
        buildObjectGroup(n1, '🍫', 0) +
        '<strong class="math-op">+</strong>' +
        buildObjectGroup(n2, '🍫', 0) +
        '</div>';
      html += '<div class="math-visual-question">' + n1 + ' 🍫 + ' + n2 + ' 🍫 = ?</div>';
    }else if(operation === '-'){
      html += '<div class="math-visual-row">' +
        buildObjectGroup(n1, '🍫', n2) +
        '</div>';
      html += '<div class="math-visual-question">' + n1 + ' 🍫 − ' + n2 + ' 🍫 = ?<br><small>🍫 yang dicoret = diambil</small></div>';
    }else if(operation === '×'){
      html += '<div class="math-visual-row">' +
        '<span class="math-mult-group">' + buildObjectGroup(n1, '🧁', 0) + '</span>' +
        '<strong class="math-op">×</strong>' +
        '<span class="math-mult-group">' + buildObjectGroup(n2, '🍫', 0) + '</span>' +
        '</div>';
      html += '<div class="math-visual-question">' + n1 + ' kelompok × ' + n2 + ' = ?</div>';
    }else{
      html += '<div class="math-visual-row"><strong>' + escapeHtml(String(a) + ' ' + operation + ' ' + String(b)) + '</strong></div>';
      html += '<div class="math-visual-question">' + escapeHtml(String(a) + ' ' + operation + ' ' + String(b) + suffix) + '</div>';
    }
    return html;
  }

  function getPlayerName(){
    try{
      const info=window.playerEventTracker?.getPlayerInfo?.() || {};
      return String(info.name || "").trim();
    }catch(e){ return ""; }
  }

  function getReturningPlayerMessage(){
    const name=getPlayerName() || "teman";
    try{
      const profile=window.getPlayerLearningProfile?.();
      const skills=profile?.skills || {};
      const labels={addition:"penjumlahan",subtraction:"pengurangan",multiplication:"perkalian",division:"pembagian"};
      let best=null;
      Object.entries(skills).forEach(([skill,data])=>{
        if(!best || Number(data.accuracy||0)>Number(best.data.accuracy||0)) best={skill,data};
      });
      const skill=best ? labels[best.skill] || best.skill : "soal matematika";
      const past=best ? "Kemarin" : "Tadi";
      return `🍫 Halo ${name}!\nAku masih ingat kamu.\n${past} kamu hebat dalam ${skill}.\nHari ini kita lanjut petualangan lagi yuk!`;
    }catch(e){
      return `🍫 Halo ${name}!\nAku masih ingat kamu.\nHari ini kita lanjut petualangan lagi yuk!`;
    }
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
      document.getElementById(options.noteId || "aiNote");

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
      ai.visual.enabled &&
      ai.visual.content
    ){

      const visual =
        document.createElement("div");

      visual.className =
        "cupcake-ai-visual";

      visual.innerHTML = formatVisualMath(ai.visual.content);

      content.appendChild(visual);

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
    speak = true,
    noteId = "aiNote"
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
      speak,
      noteId
    });

  }

  function localAnswerFeedback({
    isCorrect,
    attemptNumber,
    question
  }){

    if(isCorrect === true){

      /*
       * TTS "Hebat" hanya boleh muncul jika anak sebelumnya
       * salah lalu berhasil menjawab benar.
       * Jika benar pada percobaan pertama, tampilkan AI tanpa suara.
       */
      const hadMistakeBeforeCorrect =
        Number(attemptNumber || 1) > 1;

      showLocalCupcakeState({

        state: "celebrating",

        message:
          "🍫 Hebat!\nKamu sudah semakin pintar.\nSekarang kita coba tantangan baru yuk!",

        visual:
          "🎉🍫",

        speak: hadMistakeBeforeCorrect

      });

      return;

    }

    const attempt =
      Number(attemptNumber || 1);

    const a = question?.a;
    const b = question?.b;

    const operation =
      question?.op || "+";

    const validNumbers =
      Number.isFinite(Number(a)) &&
      Number.isFinite(Number(b));

    const expression =
      validNumbers
        ? `${a} ${operation} ${b}`
        : "";

    if(attempt <= 1){

      showLocalCupcakeState({

        state: "encouraging",

        message:
          "🍫 Tidak apa-apa!\nMari kita coba soal yang lebih mudah dulu ya.\nAku yakin kamu bisa.",

        hint:
          "Coba hitung pelan-pelan.",

        visual:
          validNumbers ? {a:a,b:b,operation:operation} : "🍫 + 🍫 = ?",

        speak: true

      });

      return;

    }

    if(attempt === 2){

      showLocalCupcakeState({

        state: "teaching",

        message:
          "🍫 Yuk kita hitung bersama. Kita buat soalnya lebih mudah ya.",

        hint:
          "Hitung satu bagian dulu.",

        visual:
          validNumbers
            ? {a:a,b:b,operation:operation}
            : "🍫 + 🍫 = ?",

        speak: true

      });

      return;

    }

    showLocalCupcakeState({

      state: "teaching",

      message:
        "Kita lakukan pelan-pelan. Hitung satu per satu ya.",

      hint:
        validNumbers
          ? `Mulai dari ${a}, lalu ${operation} ${b}.`
          : "Kerjakan langkah demi langkah.",

      visual:
        validNumbers
          ? `🍫 ${operation} 🍫\n${a} ${operation} ${b} = ?`
          : "🍫🍫 + 🍫🍫🍫 = ?",

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
      question
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

    const tracker = window.playerEventTracker;
    const playerInfo = tracker && tracker.getPlayerInfo ? tracker.getPlayerInfo() : {};
    const name = String(playerInfo.name || window.playerName || "").trim();
    const profile = window.getPlayerLearningProfile ? window.getPlayerLearningProfile() : null;
    const hasHistory = Boolean(profile && Number(profile.attempts || 0) > 0);

    let message;
    if(hasHistory){
      const skills = profile.skills || {};
      const ranked = Object.keys(skills).filter(k => skills[k] && skills[k].attempts > 0).sort((a,b) => (skills[b].accuracy||0) - (skills[a].accuracy||0));
      const best = ranked[0] || "penjumlahan";
      const skillNames = {addition:"penjumlahan",subtraction:"pengurangan",multiplication:"perkalian",division:"pembagian"};
      const skillName = skillNames[best] || best;
      message = `🍫 Halo ${name || "teman"}!\nAku masih ingat kamu.\nTadi kamu hebat dalam ${skillName}.\nHari ini kita lanjut petualangan lagi yuk!`;
    }else{
      message = `Halo ${name || "teman"}!\nAku Chocolate Cupcake.\nAku akan menemanimu bermain,\nmengingat kemajuanmu,\ndan membantumu saat kesulitan.\nAyo kita belajar sambil bermain!`;
    }

    window.sendCupcakeEvent({
      event: "game_started",
      player: { id: playerId || (playerInfo.playerId || "player"), name: name },
      game: {
        gameId: "chocolate-abyss-gate",
        level: window.getCurrentGameLevel ? window.getCurrentGameLevel() : "easy"
      },
      returningPlayer: hasHistory
    });

  };

  /* ============================================================
   * START-SCREEN / CHARACTER-SELECTION AI
   * Browser speech is reliable only after a user gesture, so
   * these functions are called directly from the game buttons.
   * ============================================================ */

  window.cupcakeSpeakWelcome = function(){
    const tracker = window.playerEventTracker;
    const info = tracker && tracker.getPlayerInfo ? tracker.getPlayerInfo() : {};
    const name = String(info.name || window.playerName || "").trim() || "teman";
    const profile = window.getPlayerLearningProfile ? window.getPlayerLearningProfile() : null;
    const hasHistory = Boolean(profile && Number(profile.attempts || 0) > 0);
    const message = hasHistory
      ? getReturningPlayerMessage()
      : `Halo ${name}!\nAku Chocolate Cupcake.\nAku akan menemanimu bermain,\nmengingat kemajuanmu,\ndan membantumu saat kesulitan.\nAyo kita belajar sambil bermain!`;
    speakCupcake(message);
  };

  window.cupcakePlayWelcome = function(){
    /* Welcome di halaman awal hanya suara — tanpa popup/gambar AI. */
    window.cupcakeSpeakWelcome();
  };

  window.cupcakeCharacterSelected = function(index){
    const chars = [
      "Cokelat Batang", "Kuki Cokelat", "Kopi", "Pretzel", "Croissant"
    ];
    const character = chars[Number(index)] || "karakter pilihanmu";
    const info = window.playerEventTracker?.getPlayerInfo?.() || {};
    const name = String(info.name || "teman").trim() || "teman";
    const message = `🍫 ${name}, kamu memilih ${character}.\nAyo kita mulai petualangan!`;

    showLocalCupcakeState({
      state: "welcome",
      message,
      visual: "🍫🧁",
      speak: true,
      noteId: "pickerAiNote"
    });
  };

  window.sendCupcakeFinalReport = function(){
    const name=getPlayerName() || "teman";
    showLocalCupcakeState({
      state:"victory",
      message:
        "🍫 Aku sudah mengingat hasil belajarmu hari ini.\nSaat kita bertemu lagi,\naku akan membantu kamu belajar\ndengan cara yang paling cocok.",
      visual:"🧠 📚 🍫",
      speak:true,
      noteId:"finalAiNote"
    });
    return name;
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
          "🍫 Aku sudah mengingat hasil belajarmu hari ini.\nSaat kita bertemu lagi,\naku akan membantu kamu belajar\ndengan cara yang paling cocok.\n\nLuar biasa! Kamu berhasil menyelesaikan Chocolate Abyss Gate! 🏆🍫🎉",

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
