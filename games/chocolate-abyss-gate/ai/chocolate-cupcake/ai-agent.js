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

    const profile = playerProfile || {};

    const accuracy =
      typeof profile.accuracy === "number"
        ? profile.accuracy
        : 1;

    const streak =
      typeof profile.streak === "number"
        ? profile.streak
        : 0;

    const attempts =
      typeof profile.attempts === "number"
        ? profile.attempts
        : 0;

    let difficulty = "easy";
    let reason = "starting";

    if(accuracy < 0.5){
      difficulty = "easy";
      reason = "low_accuracy";
    }else if(accuracy < 0.75){
      difficulty = "medium";
      reason = "developing_skill";
    }else if(accuracy >= 0.85 && streak >= 3){
      difficulty = "hard";
      reason = "strong_performance";
    }else if(attempts >= 5 && accuracy >= 0.75){
      difficulty = "medium";
      reason = "stable_progress";
    }

    return {
      difficulty,
      reason,
      confidence: Math.max(0.5, Math.min(1, accuracy))
    };
  };


  /*
   * ============================================================
   * CUPCAKE STATE
   * ============================================================
   */

  const stateImages = {
    welcome:
      "ai/chocolate-cupcake/assets/welcome.png",

    encouraging:
      "ai/chocolate-cupcake/assets/encouraging.png",

    thinking:
      "ai/chocolate-cupcake/assets/thinking.png",

    oops:
      "ai/chocolate-cupcake/assets/oops.png",

    teaching:
      "ai/chocolate-cupcake/assets/teaching.png",

    celebrating:
      "ai/chocolate-cupcake/assets/celebrating.png",

    victory:
      "ai/chocolate-cupcake/assets/victory.png"
  };


  function normalizeCupcakeState(state){

    if(!state) return "encouraging";

    const value =
      String(state)
        .toLowerCase()
        .trim();

    if(
      value === "welcome" ||
      value === "welcoming"
    ){
      return "welcome";
    }

    if(
      value === "thinking" ||
      value === "think"
    ){
      return "thinking";
    }

    if(
      value === "oops" ||
      value === "wrong"
    ){
      return "oops";
    }

    if(
      value === "teaching" ||
      value === "teaching"
    ){
      return "teaching";
    }

    if(
      value === "celebrating" ||
      value === "celebrate" ||
      value === "celebration"
    ){
      return "celebrating";
    }

    if(
      value === "victory" ||
      value === "win" ||
      value === "completed"
    ){
      return "victory";
    }

    return "encouraging";
  }


  /*
   * ============================================================
   * TEXT TO SPEECH
   * ============================================================
   */

  function speakCupcake(text){

    if(
      !text ||
      !("speechSynthesis" in window)
    ){
      return;
    }

    try{

      window.speechSynthesis.cancel();

      const utterance =
        new SpeechSynthesisUtterance(text);

      utterance.lang = "id-ID";
      utterance.rate = 0.95;
      utterance.pitch = 1.08;
      utterance.volume = 1;

      window.speechSynthesis.speak(utterance);

    }catch(error){

      console.warn(
        "Chocolate Cupcake TTS error:",
        error
      );

    }
  }


  /*
   * ============================================================
   * CUPCAKE FLOATING RESPONSE
   * ============================================================
   *
   * PENTING:
   *
   * Jangan memasukkan celebration ke #aiNote.
   *
   * #aiNote berada di dalam #questionModal.
   * questionModal ditutup setelah menjawab soal.
   *
   * Karena itu celebration dibuat langsung sebagai child
   * document.body agar tidak ikut tertutup.
   */

  window.showCupcakeResponse = function(result, options){

    options = options || {};

    if(!result){
      return;
    }

    /*
     * API dapat mengembalikan:
     *
     * {
     *   success: true,
     *   response: {...}
     * }
     *
     * atau response langsung.
     */

    const success =
      result.success !== false;

    if(!success){
      return;
    }

    const ai =
      result.response ||
      result.data ||
      result;

    if(!ai){
      return;
    }

    const state =
      normalizeCupcakeState(
        ai.state ||
        ai.emotion ||
        options.state
      );

    const image =
      stateImages[state] ||
      stateImages.encouraging;

    const message =
      ai.message ||
      ai.text ||
      options.message ||
      "";

    const hint =
      ai.hint ||
      options.hint ||
      "";

    /*
     * Hindari menampilkan hint dua kali jika API
     * memasukkan hint ke dalam message.
     */

    let finalMessage = message;

    if(
      hint &&
      hint.trim() &&
      !message.includes(hint)
    ){
      finalMessage =
        message
          ? message + " " + hint
          : hint;
    }

    /*
     * Hapus popup Chocolate Cupcake sebelumnya.
     */

    const oldPopup =
      document.getElementById(
        "cupcakeFloatingResponse"
      );

    if(oldPopup){
      oldPopup.remove();
    }

    /*
     * Hentikan timer popup sebelumnya.
     */

    if(window.cupcakeCelebrationTimer){

      clearTimeout(
        window.cupcakeCelebrationTimer
      );

      window.cupcakeCelebrationTimer = null;
    }

    /*
     * ========================================================
     * CREATE FLOATING POPUP
     * ========================================================
     */

    const popup =
      document.createElement("div");

    popup.id =
      "cupcakeFloatingResponse";

    popup.setAttribute(
      "role",
      "status"
    );

    popup.setAttribute(
      "aria-live",
      "polite"
    );

    const isCelebration =
      state === "celebrating";

    const isVictory =
      state === "victory";

    popup.style.position = "fixed";
    popup.style.left = "50%";
    popup.style.bottom = "24px";
    popup.style.transform =
      "translate(-50%, 30px)";
    popup.style.width =
      "min(560px, calc(100vw - 28px))";
    popup.style.maxWidth = "560px";
    popup.style.boxSizing = "border-box";
    popup.style.background =
      "#fff9ec";
    popup.style.border =
      "3px solid #e5bc5e";
    popup.style.borderRadius =
      "22px";
    popup.style.boxShadow =
      "0 12px 40px rgba(0,0,0,.28)";
    popup.style.padding =
      "16px 18px";
    popup.style.zIndex =
      "10000";
    popup.style.display =
      "flex";
    popup.style.alignItems =
      "center";
    popup.style.gap =
      "14px";
    popup.style.opacity =
      "0";
    popup.style.transition =
      "opacity .35s ease, transform .35s ease";
    popup.style.fontFamily =
      "inherit";

    /*
     * Saat victory / celebration, popup dibuat sedikit
     * lebih menonjol.
     */

    if(isCelebration || isVictory){

      popup.style.padding =
        "18px 20px";

      popup.style.borderWidth =
        "4px";
    }


    /*
     * ========================================================
     * CUPCAKE IMAGE
     * ========================================================
     */

    const img =
      document.createElement("img");

    img.src = image;

    img.alt =
      "Chocolate Cupcake";

    img.style.width =
      isVictory ? "105px" : "88px";

    img.style.height =
      isVictory ? "105px" : "88px";

    img.style.objectFit =
      "contain";

    img.style.flex =
      "0 0 auto";

    img.style.display =
      "block";


    /*
     * Jika asset tidak ditemukan, jangan membuat popup
     * rusak. Sembunyikan gambar saja.
     */

    img.onerror = function(){

      this.style.display =
        "none";
    };


    /*
     * ========================================================
     * CONTENT
     * ========================================================
     */

    const content =
      document.createElement("div");

    content.style.flex =
      "1";

    content.style.minWidth =
      "0";


    const title =
      document.createElement("div");

    title.style.fontWeight =
      "800";

    title.style.fontSize =
      isVictory
        ? "20px"
        : "17px";

    title.style.color =
      "#5b2d16";

    title.style.marginBottom =
      "5px";

    if(isVictory){

      title.textContent =
        "🏆 Chocolate Cupcake!";

    }else if(isCelebration){

      title.textContent =
        "🎉 Hebat!";

    }else{

      title.textContent =
        "🍫 Chocolate Cupcake";
    }


    const text =
      document.createElement("div");

    text.style.fontSize =
      "15px";

    text.style.lineHeight =
      "1.5";

    text.style.color =
      "#3b1d10";

    text.style.whiteSpace =
      "pre-wrap";

    text.textContent =
      finalMessage ||
      (
        isVictory
          ? "Kamu berhasil menyelesaikan tantangan!"
          : isCelebration
            ? "Hebat! Kamu berhasil!"
            : "Ayo kita coba bersama!"
      );


    content.appendChild(
      title
    );

    content.appendChild(
      text
    );


    /*
     * ========================================================
     * VISUAL CONTENT
     * ========================================================
     */

    if(
      ai.visual &&
      ai.visual.enabled &&
      ai.visual.content
    ){

      const visual =
        document.createElement("div");

      visual.style.marginTop =
        "8px";

      visual.style.fontSize =
        "22px";

      visual.textContent =
        ai.visual.content;

      content.appendChild(
        visual
      );
    }


    popup.appendChild(
      img
    );

    popup.appendChild(
      content
    );

    document.body.appendChild(
      popup
    );


    /*
     * ========================================================
     * FADE IN
     * ========================================================
     */

    requestAnimationFrame(function(){

      requestAnimationFrame(function(){

        popup.style.opacity =
          "1";

        popup.style.transform =
          "translate(-50%, 0)";

      });

    });


    /*
     * ========================================================
     * DISPLAY DURATION
     * ========================================================
     *
     * Normal       = 4.5 detik
     * Celebrating  = 5 detik
     * Victory      = 10 detik
     */

    const duration =
      isVictory
        ? 10000
        : isCelebration
          ? 5000
          : 4500;


    window.cupcakeCelebrationTimer =
      setTimeout(function(){

        if(!popup){
          return;
        }

        popup.style.opacity =
          "0";

        popup.style.transform =
          "translate(-50%, 30px)";

        setTimeout(function(){

          if(
            popup &&
            popup.parentNode
          ){

            popup.parentNode.removeChild(
              popup
            );
          }

        }, 400);

      }, duration);


    /*
     * ========================================================
     * TEXT TO SPEECH
     * ========================================================
     */

    if(
      options.speak === true &&
      ai.speak === true &&
      ai.message
    ){

      speakCupcake(
        ai.message
      );

    }else if(
      options.speak === true &&
      ai.speak !== false &&
      ai.message
    ){

      speakCupcake(
        ai.message
      );
    }

  };


  /*
   * ============================================================
   * ASK CUPCAKE AFTER ANSWER
   * ============================================================
   */

  window.askCupcakeAfterAnswer =
    async function(payload){

      payload =
        payload || {};

      try{

        /*
         * Tampilkan thinking sementara jika diperlukan.
         */

        /*
        showCupcakeResponse({
          success:true,
          response:{
            state:"thinking",
            message:"Hmm... kita lihat jawabannya dulu ya! 🍫"
          }
        });
        */

        const response =
          await fetch(
            CUPCAKE_API,
            {
              method:"POST",

              headers:{
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify(payload)
            }
          );

        if(!response.ok){

          throw new Error(
            "Cupcake API HTTP " +
            response.status
          );
        }

        const data =
          await response.json();

        /*
         * Kirim response AI ke UI.
         */

        showCupcakeResponse(
          data,
          {
            speak:true
          }
        );

        return data;

      }catch(error){

        console.warn(
          "Chocolate Cupcake API error:",
          error
        );

        /*
         * Jangan membuat game berhenti jika API gagal.
         */

        return {
          success:false,
          fallback:true,
          error:
            error.message
        };
      }

    };


  /*
   * ============================================================
   * SEND GAME EVENT TO CUPCAKE AI
   * ============================================================
   */

  window.sendCupcakeEvent =
    async function(eventType, payload){

      payload =
        payload || {};

      try{

        const body = {
          event:eventType,
          ...payload
        };

        const response =
          await fetch(
            CUPCAKE_API,
            {
              method:"POST",

              headers:{
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify(body)
            }
          );

        if(!response.ok){

          throw new Error(
            "Cupcake event HTTP " +
            response.status
          );
        }

        return await response.json();

      }catch(error){

        console.warn(
          "Chocolate Cupcake event error:",
          error
        );

        return {
          success:false,
          fallback:true
        };
      }

    };


  /*
   * ============================================================
   * SEND VICTORY EVENT
   * ============================================================
   */

  window.sendCupcakeVictory =
    async function(payload){

      payload =
        payload || {};

      return sendCupcakeEvent(
        "VICTORY",
        payload
      );

    };


  /*
   * ============================================================
   * WELCOME
   * ============================================================
   */

  window.showCupcakeWelcome =
    function(message){

      showCupcakeResponse({
        success:true,

        response:{
          state:"welcome",

          message:
            message ||
            "Selamat datang di Chocolate Abyss Gate! 🍫",

          hint:"Ayo kita mulai petualangan!",

          speak:true
        }

      },{
        speak:true
      });

    };


  /*
   * ============================================================
   * ENCOURAGING
   * ============================================================
   */

  window.showCupcakeEncouraging =
    function(message){

      showCupcakeResponse({
        success:true,

        response:{
          state:"encouraging",

          message:
            message ||
            "Kamu pasti bisa! Ayo coba lagi! 🍫",

          speak:true
        }

      },{
        speak:true
      });

    };


  /*
   * ============================================================
   * THINKING
   * ============================================================
   */

  window.showCupcakeThinking =
    function(message){

      showCupcakeResponse({
        success:true,

        response:{
          state:"thinking",

          message:
            message ||
            "Hmm... mari kita pikirkan bersama. 🤔🍫",

          speak:true
        }

      },{
        speak:true
      });

    };


  /*
   * ============================================================
   * OOPS
   * ============================================================
   */

  window.showCupcakeOops =
    function(message){

      showCupcakeResponse({
        success:true,

        response:{
          state:"oops",

          message:
            message ||
            "Oops! Tidak apa-apa. Kita coba lagi ya! 🍫",

          speak:true
        }

      },{
        speak:true
      });

    };


  /*
   * ============================================================
   * TEACHING
   * ============================================================
   */

  window.showCupcakeTeaching =
    function(message){

      showCupcakeResponse({
        success:true,

        response:{
          state:"teaching",

          message:
            message ||
            "Ayo kita pelajari caranya bersama! 🍫",

          speak:true
        }

      },{
        speak:true
      });

    };


  /*
   * ============================================================
   * CELEBRATING
   * ============================================================
   */

  window.showCupcakeCelebrating =
    function(message){

      showCupcakeResponse({
        success:true,

        response:{
          state:"celebrating",

          message:
            message ||
            "Hebat! Jawabanmu benar! 🎉🍫",

          hint:
            "Kamu semakin jago!",

          visual:{
            enabled:true,
            content:"🎉🍫✨"
          },

          speak:true
        }

      },{
        speak:true
      });

    };


  /*
   * ============================================================
   * VICTORY
   * ============================================================
   */

  window.showCupcakeVictoryScreen =
    function(message){

      showCupcakeResponse({
        success:true,

        response:{
          state:"victory",

          message:
            message ||
            "Luar biasa! Kamu berhasil menyelesaikan tantangan! 🏆🍫",

          hint:
            "Petualanganmu berhasil diselesaikan!",

          visual:{
            enabled:true,
            content:"🏆🎉🍫✨"
          },

          speak:true
        }

      },{
        speak:true
      });

    };


})();
