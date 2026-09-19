(function(){

  /*
   * ============================================================
   * CHOCOLATE CUPCAKE AI LEARNING COMPANION
   * Negeri Sugaria — Chocolate Abyss Gate
   * ============================================================
   *
   * Features:
   * - Adaptive Learning Decision
   * - Chocolate Cupcake AI API
   * - Visual Math Guidance
   * - Browser Text-to-Speech
   * - Indonesian Voice Detection
   * - TTS duplicate protection
   * - TTS browser unlock / priming
   * - Safe API fallback
   *
   * Tidak mengubah gameplay utama.
   */

  "use strict";


  /*
   * ============================================================
   * CONFIGURATION
   * ============================================================
   */

  const CUPCAKE_API =
    "https://api.negerisugaria.id/api/cupcake/respond";


  /*
   * ============================================================
   * LOCAL ADAPTIVE DECISION
   * ============================================================
   *
   * Function intentionally synchronous because index.html uses:
   *
   * lastAIDecision = requestAIDecision(profile);
   *
   * Jangan ubah menjadi async.
   */

  window.requestAIDecision = function(playerProfile){

    playerProfile =
      playerProfile || {};

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
      Number(
        playerProfile.averageResponseTime || 0
      ) > 7000;

    const totalAttempts =
      Number(playerProfile.attempts || 0);

    let decision;


    /*
     * BASELINE
     */

    if(totalAttempts === 0){

      decision = {
        action: "BASELINE",

        difficulty:
          playerProfile.currentDifficulty ||
          "easy",

        skill,

        useHint: false,

        reason: "no_history"
      };


    /*
     * REMEDIATION
     */

    }else if(
      recentMistakes >= 2 ||
      accuracy < 0.5
    ){

      decision = {
        action: "REMEDIATE",

        difficulty: "easy",

        skill,

        useHint: true,

        reason: "repeated_mistakes"
      };


    /*
     * SUPPORT
     */

    }else if(
      recentMistakes >= 1 ||
      accuracy < 0.7 ||
      slow
    ){

      decision = {
        action: "SUPPORT",

        difficulty: "easy",

        skill,

        useHint: true,

        reason: "needs_support"
      };


    /*
     * PRACTICE
     */

    }else{

      decision = {
        action: "PRACTICE",

        difficulty:
          playerProfile.currentDifficulty ||
          "medium",

        skill,

        useHint: false,

        reason: "continue_practice"
      };

    }


    return decision;

  };


  /*
   * ============================================================
   * CUPCAKE AI API
   * ============================================================
   */

  window.requestCupcakeResponse =
    async function(eventData){

      try{

        const response =
          await fetch(
            CUPCAKE_API,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body:
                JSON.stringify(
                  eventData || {}
                )
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


        if(
          !data ||
          !data.success
        ){

          throw new Error(
            "Invalid Cupcake API response"
          );

        }


        return data;


      }catch(error){

        console.warn(
          "[Chocolate Cupcake] API unavailable:",
          error
        );


        return {
          success: false,

          fallback: true,

          response: null,

          error: error.message

        };

      }

    };


  /*
   * ============================================================
   * TTS STATE
   * ============================================================
   */

  window.cupcakeTTS = {

    enabled: true,

    unlocked: false,

    speaking: false,

    lastText: "",

    lastSpokenAt: 0,

    voice: null

  };


  /*
   * ============================================================
   * GET AVAILABLE VOICES
   * ============================================================
   */

  function getCupcakeVoices(){

    if(
      !("speechSynthesis" in window)
    ){

      return [];

    }


    try{

      return window
        .speechSynthesis
        .getVoices() || [];

    }catch(error){

      console.warn(
        "[Chocolate Cupcake] Cannot read TTS voices:",
        error
      );

      return [];

    }

  }


  /*
   * ============================================================
   * FIND INDONESIAN VOICE
   * ============================================================
   */

  function findIndonesianVoice(){

    const voices =
      getCupcakeVoices();


    if(!voices.length){

      return null;

    }


    /*
     * Prioritas:
     * 1. id-ID
     * 2. id-*
     * 3. Tidak menggunakan voice asing
     */

    let voice =
      voices.find(
        v =>
          String(v.lang || "")
            .toLowerCase()
            === "id-id"
      );


    if(!voice){

      voice =
        voices.find(
          v =>
            String(v.lang || "")
              .toLowerCase()
              .startsWith("id")
        );

    }


    return voice || null;

  }


  /*
   * ============================================================
   * REFRESH TTS VOICE
   * ============================================================
   */

  function refreshCupcakeVoice(){

    const voice =
      findIndonesianVoice();


    window.cupcakeTTS.voice =
      voice || null;


    if(voice){

      console.log(
        "[Chocolate Cupcake] TTS voice:",
        voice.name,
        voice.lang
      );

    }else{

      console.warn(
        "[Chocolate Cupcake] Voice id-ID tidak ditemukan. Browser akan menggunakan default voice."
      );

    }


    return voice;

  }


  /*
   * ============================================================
   * BROWSER TTS UNLOCK / PRIME
   * ============================================================
   *
   * Dipanggil saat pemain menekan tombol mulai.
   *
   * Tujuannya membantu browser mengizinkan speechSynthesis
   * setelah adanya user interaction.
   */

  window.unlockChocolateCupcakeTTS =
    function(){

      if(
        !("speechSynthesis" in window) ||
        !("SpeechSynthesisUtterance" in window)
      ){

        console.warn(
          "[Chocolate Cupcake] Browser tidak mendukung Speech Synthesis."
        );

        return false;

      }


      try{

        const synth =
          window.speechSynthesis;


        /*
         * Meminta browser menyiapkan daftar voice.
         */

        synth.getVoices();

        refreshCupcakeVoice();


        /*
         * Silent utterance untuk membantu unlock.
         *
         * Tidak menggunakan karakter suara yang terlihat.
         */

        const unlock =
          new SpeechSynthesisUtterance("");


        unlock.volume = 0;


        synth.cancel();

        synth.speak(unlock);


        window.cupcakeTTS.unlocked =
          true;


        console.log(
          "[Chocolate Cupcake] TTS unlocked."
        );


        return true;


      }catch(error){

        console.warn(
          "[Chocolate Cupcake] TTS unlock error:",
          error
        );


        return false;

      }

    };


  /*
   * ============================================================
   * CLEAN TEXT FOR TTS
   * ============================================================
   */

  function cleanCupcakeSpeech(text){

    if(!text){

      return "";

    }


    return String(text)

      /*
       * Emoji yang tidak perlu dibaca.
       */

      .replace(
        /🍫|🎉|🏆|💪|😊|✨|⭐|❤️|❤|🥳|👏|👍|🌟|😁|😄|🙂|😉/g,
        ""
      )

      /*
       * Markdown sederhana.
       */

      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`/g, "")

      /*
       * Rapikan whitespace.
       */

      .replace(/\s+/g, " ")

      .trim();

  }


  /*
   * ============================================================
   * SPEAK CHOCOLATE CUPCAKE
   * ============================================================
   */

  window.speakChocolateCupcake =
    function(text){

      if(
        !window.cupcakeTTS.enabled
      ){

        return false;

      }


      if(!text){

        return false;

      }


      if(
        !("speechSynthesis" in window) ||
        !("SpeechSynthesisUtterance" in window)
      ){

        console.warn(
          "[Chocolate Cupcake] Browser TTS tidak tersedia."
        );

        return false;

      }


      const cleanText =
        cleanCupcakeSpeech(text);


      if(!cleanText){

        return false;

      }


      /*
       * Jangan membaca teks yang sama berulang dalam waktu singkat.
       */

      const now =
        Date.now();


      if(
        window.cupcakeTTS.lastText ===
          cleanText &&

        now -
          window.cupcakeTTS.lastSpokenAt
          < 3000
      ){

        console.log(
          "[Chocolate Cupcake] Duplicate TTS skipped."
        );

        return false;

      }


      window.cupcakeTTS.lastText =
        cleanText;

      window.cupcakeTTS.lastSpokenAt =
        now;


      try{

        const synth =
          window.speechSynthesis;


        /*
         * Refresh voice karena beberapa browser baru
         * menyediakan voice setelah beberapa saat.
         */

        const voice =
          window.cupcakeTTS.voice ||
          refreshCupcakeVoice();


        /*
         * Hentikan suara sebelumnya.
         */

        synth.cancel();


        const utterance =
          new SpeechSynthesisUtterance(
            cleanText
          );


        /*
         * Bahasa Indonesia.
         */

        utterance.lang =
          voice
            ? voice.lang
            : "id-ID";


        if(voice){

          utterance.voice =
            voice;

        }


        /*
         * Karakter suara Chocolate Cupcake:
         *
         * rate   = sedikit lebih lambat
         * pitch  = sedikit lebih tinggi
         * volume = penuh
         */

        utterance.rate =
          0.90;

        utterance.pitch =
          1.08;

        utterance.volume =
          1.0;


        utterance.onstart =
          function(){

            window.cupcakeTTS.speaking =
              true;


            document.documentElement
              .classList
              .add(
                "cupcake-speaking"
              );


            console.log(
              "[Chocolate Cupcake] 🔊 Speaking:",
              cleanText
            );

          };


        utterance.onend =
          function(){

            window.cupcakeTTS.speaking =
              false;


            document.documentElement
              .classList
              .remove(
                "cupcake-speaking"
              );

          };


        utterance.onerror =
          function(event){

            window.cupcakeTTS.speaking =
              false;


            document.documentElement
              .classList
              .remove(
                "cupcake-speaking"
              );


            console.warn(
              "[Chocolate Cupcake] TTS error:",
              event
            );

          };


        synth.speak(
          utterance
        );


        return true;


      }catch(error){

        console.warn(
          "[Chocolate Cupcake] TTS exception:",
          error
        );


        return false;

      }

    };


  /*
   * ============================================================
   * LOAD BROWSER VOICES
   * ============================================================
   */

  if(
    "speechSynthesis" in window
  ){

    /*
     * Beberapa browser mengisi voice secara asynchronous.
     */

    window.speechSynthesis.onvoiceschanged =
      function(){

        const voices =
          getCupcakeVoices();


        refreshCupcakeVoice();


        console.log(
          "[Chocolate Cupcake] TTS voices loaded:",
          voices.length
        );

      };


    /*
     * Coba load langsung juga.
     */

    setTimeout(
      function(){

        refreshCupcakeVoice();

      },
      300
    );

  }


  /*
   * ============================================================
   * DISPLAY CHOCOLATE CUPCAKE RESPONSE
   * ============================================================
   */

  function showCupcakeResponse(data){

    if(
      !data ||
      !data.success ||
      !data.response
    ){

      return;

    }


    const ai =
      data.response;


    const note =
      document.getElementById(
        "aiNote"
      );


    if(!note){

      console.warn(
        "[Chocolate Cupcake] #aiNote tidak ditemukan."
      );

      /*
       * TTS tetap boleh berjalan walaupun UI popup
       * tidak ditemukan.
       */

    }


    /*
     * ========================================================
     * STATE IMAGE
     * ========================================================
     */

    const stateImages = {

      welcome:
        "sources/welcome.png",

      encouraging:
        "sources/encouraging.png",

      thinking:
        "sources/thinking.png",

      oops:
        "sources/oops.png",

      teaching:
        "sources/theaching.png",

      celebrating:
        "sources/celebrating.png",

      victory:
        "sources/victory.png"

    };


    const state =
      String(
        ai.state ||
        ai.emotion ||
        "encouraging"
      )
        .toLowerCase()
        .trim();


    const imageSrc =
      stateImages[state] ||
      stateImages.encouraging;


    /*
     * ========================================================
     * MESSAGE
     * ========================================================
     */

    const message =
      typeof ai.message === "string"
        ? ai.message.trim()
        : "";


    const hint =
      typeof ai.hint === "string"
        ? ai.hint.trim()
        : "";


    /*
     * ========================================================
     * POPUP UI
     * ========================================================
     */

    if(note){

      const wrapper =
        document.createElement(
          "div"
        );


      wrapper.className =
        "cupcake-ai-response";


      const image =
        document.createElement(
          "img"
        );


      image.className =
        "cupcake-ai-image";


      image.src =
        imageSrc;


      image.alt =
        "Chocolate Cupcake";


      image.loading =
        "eager";


      image.onerror =
        function(){

          console.warn(
            "[Chocolate Cupcake] Asset tidak ditemukan:",
            imageSrc
          );

        };


      const content =
        document.createElement(
          "div"
        );


      content.className =
        "cupcake-ai-content";


      const title =
        document.createElement(
          "strong"
        );


      title.textContent =
        "🍫 Chocolate Cupcake";


      const text =
        document.createElement(
          "div"
        );


      text.className =
        "cupcake-ai-message";


      text.textContent =
        message;


      content.appendChild(
        title
      );


      content.appendChild(
        text
      );


      /*
       * Hint.
       */

      if(hint){

        const hintElement =
          document.createElement(
            "div"
          );


        hintElement.className =
          "cupcake-ai-hint";


        hintElement.textContent =
          hint;


        content.appendChild(
          hintElement
        );

      }


      /*
       * Visual math.
       */

      if(
        ai.visual &&
        ai.visual.enabled &&
        ai.visual.content
      ){

        const visual =
          document.createElement(
            "div"
          );


        visual.className =
          "cupcake-ai-visual";


        visual.textContent =
          ai.visual.content;


        content.appendChild(
          visual
        );

      }


      wrapper.appendChild(
        image
      );


      wrapper.appendChild(
        content
      );


      note.appendChild(
        wrapper
      );


      note.classList.remove(
        "hidden"
      );


      /*
       * Celebrating hanya ditampilkan beberapa detik.
       */

      if(
        state === "celebrating"
      ){

        if(
          window.cupcakeCelebrationTimer
        ){

          clearTimeout(
            window.cupcakeCelebrationTimer
          );

        }


        window.cupcakeCelebrationTimer =
          setTimeout(
            function(){

              note.classList.add(
                "hidden"
              );

            },
            5000
          );

      }

    }


    /*
     * ========================================================
     * TTS
     * ========================================================
     *
     * AI dapat mengirim:
     *
     * "speak": true
     *
     * Secara default normalize() di server juga menganggap
     * speak = true.
     */

    if(
      ai.speak !== false &&
      message
    ){

      let speechText =
        message;


      /*
       * Hint ikut dibacakan agar Chocolate Cupcake
       * dapat memberikan bantuan lengkap.
       */

      if(hint){

        speechText +=
          " " + hint;

      }


      window.speakChocolateCupcake(
        speechText
      );

    }

  }


  /*
   * Export display function jika diperlukan oleh game.
   */

  window.showCupcakeResponse =
    showCupcakeResponse;


  /*
   * ============================================================
   * SEND GAME EVENT TO CUPCAKE AI
   * ============================================================
   *
   * Jangan await.
   *
   * Game harus tetap berjalan walaupun AI membutuhkan waktu
   * atau API sedang overload.
   */

  window.sendCupcakeEvent =
    function(eventData){

      window.requestCupcakeResponse(
        eventData
      )
        .then(
          showCupcakeResponse
        )
        .catch(
          function(error){

            console.warn(
              "[Chocolate Cupcake] Event error:",
              error
            );

          }
        );

    };


  /*
   * ============================================================
   * HELPER: BUILD ANSWER EVENT
   * ============================================================
   */

  window.askCupcakeAfterAnswer =
    function({

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
       * ================================================
       * TTS UNLOCK
       * ================================================
       *
       * Jika fungsi ini dipanggil langsung dari interaksi
       * pemain, browser mendapat kesempatan mengaktifkan TTS.
       */

      if(
        !window.cupcakeTTS.unlocked
      ){

        window.unlockChocolateCupcakeTTS();

      }


      /*
       * ================================================
       * CORRECT ANSWER
       * ================================================
       *
       * Tampilkan celebrating langsung agar UI game
       * tidak menunggu API.
       */

      if(
        isCorrect === true
      ){

        showCupcakeResponse({

          success: true,

          response: {

            state:
              "celebrating",

            message:
              "Benar! Hebat sekali! 🍫🎉",

            hint:
              "",

            visual: {

              enabled:
                true,

              content:
                "🎉🍫"

            },

            /*
             * TTS langsung.
             */

            speak:
              true,

            emotion:
              "excited"

          }

        });

      }


      /*
       * ================================================
       * SEND EVENT TO AI
       * ================================================
       */

      window.sendCupcakeEvent({

        event:
          "answer_submitted",


        player: {

          id:
            playerId ||
            "player"

        },


        game: {

          gameId:
            "chocolate-abyss-gate",

          level:
            difficulty ||
            "easy"

        },


        question: {

          type:
            skill ||
            "addition",

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
          attemptNumber ||
          1,


        context: {

          responseTime:
            responseTime ||
            0,

          skill:
            skill ||
            "addition"

        }

      });

    };


  /*
   * ============================================================
   * WELCOME
   * ============================================================
   */

  window.startCupcakeWelcome =
    function(playerId){

      /*
       * Penting:
       *
       * Fungsi ini idealnya dipanggil ketika pemain menekan
       * tombol "Mulai" sehingga browser menganggapnya sebagai
       * user interaction.
       */

      window.unlockChocolateCupcakeTTS();


      window.sendCupcakeEvent({

        event:
          "game_started",


        player: {

          id:
            playerId ||
            "player"

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

  window.sendCupcakeVictory =
    function({

      playerId,

      level,

      correct,

      wrong

    }){


      window.sendCupcakeEvent({

        event:
          "level_completed",


        player: {

          id:
            playerId ||
            "player"

        },


        game: {

          gameId:
            "chocolate-abyss-gate",

          level:
            level ||
            "easy"

        },


        progress: {

          correct:
            correct ||
            0,

          wrong:
            wrong ||
            0,

          completed:
            true

        }

      });

    };


  /*
   * ============================================================
   * OPTIONAL TTS CONTROL
   * ============================================================
   *
   * Bisa digunakan oleh index.html jika nanti ingin membuat
   * tombol suara ON/OFF.
   */

  window.setChocolateCupcakeTTS =
    function(enabled){

      window.cupcakeTTS.enabled =
        enabled !== false;


      if(
        !window.cupcakeTTS.enabled &&
        "speechSynthesis" in window
      ){

        try{

          window.speechSynthesis.cancel();

        }catch(error){

          console.warn(
            "[Chocolate Cupcake] TTS cancel error:",
            error
          );

        }

      }


      console.log(
        "[Chocolate Cupcake] TTS:",
        window.cupcakeTTS.enabled
          ? "ON"
          : "OFF"
      );


      return window.cupcakeTTS.enabled;

    };


  /*
   * ============================================================
   * STOP TTS
   * ============================================================
   */

  window.stopChocolateCupcakeTTS =
    function(){

      if(
        "speechSynthesis" in window
      ){

        try{

          window.speechSynthesis.cancel();

          window.cupcakeTTS.speaking =
            false;

        }catch(error){

          console.warn(
            "[Chocolate Cupcake] Cannot stop TTS:",
            error
          );

        }

      }

    };


  /*
   * ============================================================
   * INITIALIZATION
   * ============================================================
   */

  console.log(
    "[Chocolate Cupcake] AI Agent loaded."
  );


  console.log(
    "[Chocolate Cupcake] TTS available:",
    "speechSynthesis" in window
  );


})();
