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

  window.requestCupcakeResponse = async function(eventData){

    try{

      const response = await fetch(CUPCAKE_API, {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(eventData)
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
   * DISPLAY CHOCOLATE CUPCAKE RESPONSE
   * ============================================================
   */

  function showCupcakeResponse(data){

    if(!data || !data.success || !data.response){
      return;
    }

    const ai = data.response;

    const note =
      document.getElementById("aiNote");

    if(!note){
      return;
    }

    let message = ai.message || "";

    if(ai.hint){
      message += " " + ai.hint;
    }

    if(ai.visual && ai.visual.enabled && ai.visual.content){

      message +=
        "\n\n" + ai.visual.content;
    }

    note.textContent =
      "🍫 Chocolate Cupcake: " + message;

    note.classList.remove("hidden");

    /*
     * TTS
     */
    if(
      ai.speak === true &&
      "speechSynthesis" in window &&
      ai.message
    ){

      try{

        window.speechSynthesis.cancel();

        const utterance =
          new SpeechSynthesisUtterance(ai.message);

        utterance.lang = "id-ID";
        utterance.rate = 0.95;
        utterance.pitch = 1.05;

        window.speechSynthesis.speak(
          utterance
        );

      }catch(error){

        console.warn(
          "[Chocolate Cupcake] TTS error:",
          error
        );

      }

    }

  }


  /*
   * ============================================================
   * SEND GAME EVENT TO CUPCAKE AI
   * ============================================================
   */

  window.sendCupcakeEvent = function(eventData){

    /*
     * Jangan await.
     *
     * Game harus tetap berjalan walaupun AI membutuhkan waktu
     * atau API sedang overload.
     */
    requestCupcakeResponse(eventData)
      .then(showCupcakeResponse)
      .catch(error => {

        console.warn(
          "[Chocolate Cupcake] Event error:",
          error
        );

      });

  };


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

    sendCupcakeEvent({

      event: "answer_submitted",

      player: {
        id: playerId || "player"
      },

      game: {
        gameId: "chocolate-abyss-gate",
        level: difficulty || "easy"
      },

      question: {
        type: skill || "addition",
        a: question?.a,
        b: question?.b,
        operation: question?.op,
        correctAnswer
      },

      answer: {
        value: playerAnswer,
        correct: isCorrect
      },

      attempt: attemptNumber || 1,

      context: {
        responseTime: responseTime || 0,
        skill: skill || "addition"
      }

    });

  };


  /*
   * ============================================================
   * WELCOME
   * ============================================================
   */

  window.startCupcakeWelcome = function(playerId){

    sendCupcakeEvent({

      event: "game_started",

      player: {
        id: playerId || "player"
      },

      game: {
        gameId: "chocolate-abyss-gate",
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

    sendCupcakeEvent({

      event: "level_completed",

      player: {
        id: playerId || "player"
      },

      game: {
        gameId: "chocolate-abyss-gate",
        level: level || "easy"
      },

      progress: {
        correct: correct || 0,
        wrong: wrong || 0,
        completed: true
      }

    });

  };


})();
