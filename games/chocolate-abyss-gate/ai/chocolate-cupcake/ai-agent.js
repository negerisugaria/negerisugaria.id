/* ============================================================
   CHOCOLATE ABYSS GATE
   CHOCOLATE CUPCAKE AI AGENT
   ============================================================

   Role:
   Chocolate Cupcake = AI Learning Companion

   Traits:
   - Friendly
   - Cheerful
   - Educational
   - Encouraging

   Mission:
   Guide children through Chocolate Abyss Gate
   while improving mathematics skills.

   FEATURES
   ------------------------------------------------------------
   1. Chocolate Cupcake AI companion
   2. AI backend integration
   3. Player Learning Profile
   4. Adaptive Learning Decision
   5. Event Tracking integration
   6. OpenClaw Memory adapter
   7. STT Indonesian
   8. TTS Indonesian
   9. Visual Math
   10. AI state expressions
   11. Answer feedback
   12. Tutor request
   13. Learning Resume
   14. Offline fallback
   15. Memory synchronization
   ============================================================ */

(function () {
  "use strict";


  /* ============================================================
     CONFIGURATION
     ============================================================ */

  const CONFIG = {

    CUPCAKE_API:
      window.CHOCOLATE_CUPCAKE_API ||
      "https://api.negerisugaria.id/api/cupcake/respond",

    MEMORY_API:
      window.CHOCOLATE_MEMORY_API ||
      "https://api.negerisugaria.id/api/memory",

    API_TIMEOUT:
      8000,

    MEMORY_TIMEOUT:
      8000,

    LANGUAGE:
      "id-ID",

    MAX_CHAT_HISTORY:
      20,

    MAX_RECENT_EVENTS:
      20,

    TTS_RATE:
      0.95,

    TTS_PITCH:
      1.08,

    TTS_VOLUME:
      1.0,

    STT_MAX_ALTERNATIVES:
      3
  };


  /* ============================================================
     CUPCAKE PERSONA
     ============================================================ */

  const CUPCAKE_PERSONA = {

    name:
      "Chocolate Cupcake",

    role:
      "AI Learning Companion",

    traits: [
      "Friendly",
      "Cheerful",
      "Educational",
      "Encouraging"
    ],

    mission:
      "Guide children through Chocolate Abyss Gate while improving mathematics skills.",

    language:
      "Bahasa Indonesia",

    style:
      "short, friendly, encouraging, child-safe, educational",

    rules: [

      "Gunakan bahasa Indonesia yang sederhana.",

      "Jangan mempermalukan pemain ketika salah.",

      "Jangan memberikan jawaban matematika secara langsung sebelum memberi kesempatan mencoba.",

      "Jika pemain salah, berikan petunjuk bertahap.",

      "Gunakan ekspresi positif.",

      "Sesuaikan bantuan dengan usia dan kemampuan pemain.",

      "Jika pemain mengalami beberapa kesalahan, sederhanakan penjelasan.",

      "Jika pemain berhasil, berikan apresiasi.",

      "Jangan memberikan informasi yang tidak berhubungan dengan permainan."

    ]
  };


  /* ============================================================
     CUPCAKE EXPRESSIONS
     ============================================================ */

  const CUPCAKE_STATES = {

    welcome: {
      image:
        "sources/welcome.png",
      label:
        "😊 Welcome"
    },

    thinking: {
      image:
        "sources/thinking.png",
      label:
        "🤔 Thinking"
    },

    oops: {
      image:
        "sources/oops.png",
      label:
        "😯 Oops"
    },

    teaching: {
      image:
        "sources/theaching.png",
      label:
        "💡 Teaching"
    },

    celebrating: {
      image:
        "sources/celebrating.png",
      label:
        "🎉 Celebrating"
    },

    victory: {
      image:
        "sources/victory.png",
      label:
        "🏆 Victory"
    },

    encouraging: {
      image:
        "sources/encouraging.png",
      label:
        "💪 Encouraging"
    }
  };


  /* ============================================================
     INTERNAL STATE
     ============================================================ */

  const state = {

    playerId:
      null,

    playerName:
      "",

    playerAge:
      null,

    currentState:
      "welcome",

    currentQuestion:
      null,

    currentDecision:
      null,

    currentProfile:
      null,

    chatHistory:
      [],

    requestSequence:
      0,

    thinking:
      false,

    speaking:
      false,

    listening:
      false,

    ttsUnlocked:
      false,

    sttSupported:
      false,

    ttsSupported:
      false,

    recognition:
      null,

    speechBuffer:
      "",

    lastResponse:
      "",

    wrongCount:
      0,

    currentQuestionAttempts:
      0,

    questionStartedAt:
      null,

    initialized:
      false
  };


  /* ============================================================
     GENERIC HELPERS
     ============================================================ */

  function nowISO() {
    return new Date().toISOString();
  }


  function safeNumber(value, fallback = 0) {

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
  }


  function safeInteger(value, fallback = 0) {

    const number =
      parseInt(value, 10);

    return Number.isFinite(number)
      ? number
      : fallback;
  }


  function clamp(value, min, max) {

    return Math.min(
      Math.max(value, min),
      max
    );
  }


  function createId(prefix) {

    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 10)
    );
  }


  function dispatch(name, detail = {}) {

    try {

      window.dispatchEvent(
        new CustomEvent(
          name,
          {
            detail
          }
        )
      );

    } catch (error) {

      console.warn(
        "[Chocolate Cupcake] Event error:",
        error
      );
    }
  }


  /* ============================================================
     PLAYER EVENT TRACKER ACCESS
     ============================================================ */

  function getTracker() {

    return (
      window.playerEventTracker ||
      null
    );
  }


  function getProfile() {

    try {

      if (
        typeof window.getPlayerLearningProfile ===
        "function"
      ) {

        return (
          window.getPlayerLearningProfile() ||
          null
        );
      }

    } catch (error) {

      console.warn(
        "[Chocolate Cupcake] Profile error:",
        error
      );
    }

    return null;
  }


  function getPlayerInfo() {

    try {

      if (
        typeof window.playerEventTracker
          ?.getPlayerInfo ===
        "function"
      ) {

        return (
          window.playerEventTracker
            .getPlayerInfo() ||
          {}
        );
      }

    } catch (_) {}

    return {

      playerId:
        state.playerId,

      name:
        state.playerName,

      age:
        state.playerAge
    };
  }


  /* ============================================================
     PLAYER ID
     ============================================================ */

  function resolvePlayerId() {

    const info =
      getPlayerInfo();

    return (
      info.playerId ||
      state.playerId ||
      localStorage.getItem(
        "chocolateAbyssPlayerId"
      ) ||
      createId("player")
    );
  }


  /* ============================================================
     CURRENT LEVEL
     ============================================================ */

  function getCurrentLevel() {

    try {

      if (
        typeof window.getCurrentGameLevel ===
        "function"
      ) {

        return window.getCurrentGameLevel();
      }

    } catch (_) {}

    return (
      window.levelKey ||
      window.currentLevel ||
      null
    );
  }


  /* ============================================================
     EVENT TRACKING
     ============================================================ */

  function trackEvent(
    type,
    payload = {}
  ) {

    try {

      if (
        typeof window.trackPlayerEvent ===
        "function"
      ) {

        return window.trackPlayerEvent(
          type,
          {
            playerId:
              state.playerId,

            level:
              payload.level ||
              getCurrentLevel(),

            ...payload
          }
        );
      }


      const tracker =
        getTracker();

      if (
        tracker &&
        typeof tracker.track ===
        "function"
      ) {

        return tracker.track(
          type,
          payload
        );
      }

    } catch (error) {

      console.warn(
        "[Chocolate Cupcake] Tracking error:",
        error
      );
    }

    return null;
  }


  /* ============================================================
     API FETCH WITH TIMEOUT
     ============================================================ */

  async function fetchWithTimeout(
    url,
    options = {},
    timeout = CONFIG.API_TIMEOUT
  ) {

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () =>
          controller.abort(),
        timeout
      );

    try {

      return await fetch(
        url,
        {
          ...options,
          signal:
            controller.signal
        }
      );

    } finally {

      clearTimeout(timer);
    }
  }


  /* ============================================================
     CUPCAKE API REQUEST
     ============================================================ */

  async function requestCupcakeAPI(
    eventData = {}
  ) {

    const requestId =
      createId("cupcake");

    state.requestSequence++;

    const payload = {

      requestId,

      requestSequence:
        state.requestSequence,

      timestamp:
        nowISO(),

      persona:
        CUPCAKE_PERSONA,

      player: {

        playerId:
          state.playerId,

        name:
          state.playerName,

        age:
          state.playerAge
      },

      profile:
        getProfile(),

      event:
        eventData,

      currentLevel:
        getCurrentLevel(),

      question:
        state.currentQuestion
    };


    try {

      const response =
        await fetchWithTimeout(
          CONFIG.CUPCAKE_API,
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

              "Accept":
                "application/json"
            },

            body:
              JSON.stringify(
                payload
              )
          },

          CONFIG.API_TIMEOUT
        );


      if (!response.ok) {

        throw new Error(
          "Cupcake API HTTP " +
          response.status
        );
      }


      const data =
        await response.json();


      return {

        success:
          true,

        requestId,

        data
      };

    } catch (error) {

      console.warn(
        "[Chocolate Cupcake] API unavailable:",
        error
      );


      return {

        success:
          false,

        requestId,

        error:
          error.message
      };
    }
  }


  /* ============================================================
     NORMALIZE API RESPONSE
     ============================================================ */

  function normalizeCupcakeResponse(
    result
  ) {

    if (!result) {
      return "";
    }


    if (
      typeof result ===
      "string"
    ) {

      return result.trim();
    }


    const data =
      result.data ||
      result;


    return String(

      data.response ||

      data.message ||

      data.reply ||

      data.text ||

      data.answer ||

      data.content ||

      ""

    ).trim();
  }


  /* ============================================================
     LOCAL CUPCAKE RESPONSE
     ============================================================ */

  function localResponse(
    eventData = {}
  ) {

    const profile =
      getProfile() ||
      {};

    const accuracy =
      safeNumber(
        profile.accuracy,
        0
      );

    const mistakes =
      safeInteger(
        profile.mistakes,
        0
      );

    const skill =
      profile.recommendedSkill ||
      eventData.skill ||
      "matematika";


    if (
      eventData.type ===
      "game_started"
    ) {

      return (
        "Hai! Aku Chocolate Cupcake 🍫🧁 " +
        "Ayo kita pecahkan labirin bersama. " +
        "Kamu pasti bisa!"
      );
    }


    if (
      eventData.type ===
      "answer_submitted"
    ) {

      if (
        eventData.correct ===
        true
      ) {

        return (
          "Hebat! 🎉 Jawabanmu benar! " +
          "Ayo lanjut ke misi berikutnya."
        );
      }


      if (
        eventData.attempts >=
        2
      ) {

        return (
          "Tidak apa-apa 😊 " +
          "Coba kita pecah soalnya menjadi langkah yang lebih kecil. " +
          "Perhatikan angkanya satu per satu ya."
        );
      }


      return (
        "Hmm, hampir benar! 😯 " +
        "Coba periksa lagi angka dan tandanya. " +
        "Kamu masih punya kesempatan!"
      );
    }


    if (
      eventData.type ===
      "tutor_request"
    ) {

      return (
        "Aku akan membantu sedikit dulu 💡 " +
        "Coba perhatikan bagian soal yang paling mudah. " +
        "Setelah itu kita lanjutkan langkah berikutnya."
      );
    }


    if (
      eventData.type ===
      "level_completed"
    ) {

      return (
        "Yeay! 🎉 Kamu berhasil menyelesaikan level ini! " +
        "Aku melihat kamu semakin jago. " +
        "Ayo lanjut ke tantangan berikutnya!"
      );
    }


    if (
      accuracy < 0.5 ||
      mistakes >= 3
    ) {

      return (
        "Kita pelan-pelan ya 😊 " +
        "Aku akan memberikan petunjuk lebih sederhana. " +
        "Kita fokus latihan " +
        skill +
        " bersama."
      );
    }


    return (
      "Semangat! 💪 " +
      "Perhatikan soal dengan teliti dan coba lagi."
    );
  }


  /* ============================================================
     SHOW CUPCAKE STATE
     ============================================================ */

  function showCupcakeState(
    stateName,
    options = {}
  ) {

    const cupcakeState =
      CUPCAKE_STATES[
        stateName
      ] ||
      CUPCAKE_STATES.welcome;


    state.currentState =
      stateName;


    const image =
      cupcakeState.image;


    /*
     * Existing game function.
     */

    try {

      if (
        typeof window.showCupcakeAgentState ===
        "function"
      ) {

        window.showCupcakeAgentState(
          stateName,
          options.text ||
          ""
        );

        return;

      }

    } catch (_) {}


    /*
     * Generic DOM fallback.
     */

    const imageElements =
      document.querySelectorAll(
        "[data-cupcake-image], .cupcake-image, #cupcakeImage"
      );


    imageElements.forEach(
      element => {

        if (element.tagName === "IMG") {

          element.src =
            image;
        }

        element.dataset.state =
          stateName;
      }
    );


    const stateLabels =
      document.querySelectorAll(
        "[data-cupcake-state]"
      );


    stateLabels.forEach(
      element => {

        element.textContent =
          cupcakeState.label;
      }
    );


    dispatch(
      "cupcake-state-changed",
      {
        state:
          stateName,

        image:
          image,

        label:
          cupcakeState.label
      }
    );
  }


  /* ============================================================
     SHOW CUPCAKE RESPONSE
     ============================================================ */

  function showCupcakeResponse(
    response,
    options = {}
  ) {

    if (!response) {
      return;
    }


    state.lastResponse =
      response;


    const text =
      String(response);


    /*
     * Existing game UI
     */

    try {

      if (
        typeof window.showCupcakeResponse ===
        "function" &&
        window.showCupcakeResponse !==
          showCupcakeResponse
      ) {

        window.showCupcakeResponse(
          response,
          options
        );
      }

    } catch (_) {}


    /*
     * Generic DOM fallback
     */

    const responseElements =
      document.querySelectorAll(
        "[data-cupcake-response], #cupcakeResponse, .cupcake-response"
      );


    responseElements.forEach(
      element => {

        element.textContent =
          text;
      }
    );


    dispatch(
      "cupcake-response",
      {
        text:
          text,

        state:
          state.currentState
      }
    );


    if (
      options.speak !== false
    ) {

      speakChocolateCupcake(
        text
      );
    }
  }


  /* ============================================================
     THINKING
     ============================================================ */

  function showThinking() {

    showCupcakeState(
      "thinking"
    );
  }


  /* ============================================================
     OOPS
     ============================================================ */

  function showOops() {

    showCupcakeState(
      "oops"
    );
  }


  /* ============================================================
     TEACHING
     ============================================================ */

  function showTeaching() {

    showCupcakeState(
      "teaching"
    );
  }


  /* ============================================================
     ENCOURAGING
     ============================================================ */

  function showEncouraging() {

    showCupcakeState(
      "encouraging"
    );
  }


  /* ============================================================
     CELEBRATING
     ============================================================ */

  function showCelebrating() {

    showCupcakeState(
      "celebrating"
    );
  }


  /* ============================================================
     VICTORY
     ============================================================ */

  function showVictory() {

    showCupcakeState(
      "victory"
    );
  }


  /* ============================================================
     ADAPTIVE LEARNING
     ============================================================ */

  function calculateAdaptiveDecision(
    profile
  ) {

    profile =
      profile ||
      getProfile() ||
      {};


    const accuracy =
      safeNumber(
        profile.accuracy,
        0
      );

    const mistakes =
      safeInteger(
        profile.mistakes,
        0
      );

    const attempts =
      safeInteger(
        profile.attempts,
        0
      );

    const averageResponseTime =
      safeNumber(
        profile.averageResponseTimeMs,
        0
      );


    const recentMistakes =
      Array.isArray(
        profile.recentMistakes
      )
        ? profile.recentMistakes
        : [];


    const recentMistakeCount =
      recentMistakes.length >= 3
        ? 3
        : recentMistakes.length;


    let decision =
      "PRACTICE";

    let reason =
      "Pemain dapat melanjutkan latihan normal.";

    let difficultyAdjustment =
      0;


    /*
     * REMEDIATION
     */

    if (
      recentMistakeCount >= 2 ||
      accuracy < 0.5
    ) {

      decision =
        "REMEDIATE";

      reason =
        "Pemain membutuhkan bantuan dan soal yang lebih sederhana.";

      difficultyAdjustment =
        -1;
    }


    /*
     * SUPPORT
     */

    else if (
      mistakes >= 2 ||
      accuracy < 0.7 ||
      averageResponseTime > 7000
    ) {

      decision =
        "SUPPORT";

      reason =
        "Pemain menunjukkan tanda membutuhkan petunjuk tambahan.";

      difficultyAdjustment =
        -1;
    }


    /*
     * STABLE PRACTICE
     */

    else if (
      accuracy >= 0.8 &&
      attempts > 0
    ) {

      decision =
        "CHALLENGE";

      reason =
        "Pemain menunjukkan performa yang cukup baik.";

      difficultyAdjustment =
        1;
    }


    const skill =
      profile.recommendedSkill ||
      null;


    return {

      decision,

      reason,

      difficultyAdjustment,

      recommendedSkill:
        skill,

      accuracy,

      mistakes,

      attempts,

      averageResponseTimeMs:
        averageResponseTime
    };
  }


  /* ============================================================
     REQUEST AI DECISION
     ============================================================ */

  async function requestAIDecision(
    profile
  ) {

    const localDecision =
      calculateAdaptiveDecision(
        profile
      );


    state.currentDecision =
      localDecision;


    trackEvent(
      "AI_DECISION",
      {
        decision:
          localDecision.decision,

        reason:
          localDecision.reason,

        recommendedSkill:
          localDecision.recommendedSkill,

        difficultyAdjustment:
          localDecision.difficultyAdjustment,

        source:
          "local-adaptive-engine"
      }
    );


    dispatch(
      "cupcake-ai-decision",
      localDecision
    );


    /*
     * Let game use the decision.
     */

    window.adaptiveDifficultyOverride =
      localDecision
        .difficultyAdjustment;


    window.currentAIDecision =
      localDecision;


    return localDecision;
  }


  /* ============================================================
     QUESTION START
     ============================================================ */

  function startQuestion(
    question = {}
  ) {

    state.currentQuestion =
      {
        ...question
      };

    state.currentQuestionAttempts =
      0;

    state.questionStartedAt =
      Date.now();

    state.wrongCount =
      0;


    const skill =
      question.skill ||
      operatorToSkill(
        question.op ||
        question.operator
      );


    state.currentQuestion.skill =
      skill;


    trackEvent(
      "QUESTION_SHOWN",
      {
        questionId:
          question.questionId,

        skill,

        operator:
          question.op ||
          question.operator,

        a:
          question.a ??
          question.left,

        b:
          question.b ??
          question.right,

        level:
          question.level ||
          getCurrentLevel(),

        difficulty:
          question.difficulty ||
          getCurrentLevel()
      }
    );


    requestAIDecision(
      getProfile()
    );


    return state.currentQuestion;
  }


  /* ============================================================
     OPERATOR TO SKILL
     ============================================================ */

  function operatorToSkill(
    operator
  ) {

    switch (operator) {

      case "+":
        return "addition";

      case "-":
        return "subtraction";

      case "*":
      case "×":
        return "multiplication";

      case "/":
      case "÷":
        return "division";

      default:
        return "general_math";
    }
  }


  /* ============================================================
     ANSWER FEEDBACK
     ============================================================ */

  async function askCupcakeAfterAnswer(
    answerData = {}
  ) {

    const correct =
      Boolean(
        answerData.correct === true ||
        answerData.isCorrect === true
      );


    state.currentQuestionAttempts =
      Math.max(
        1,
        safeInteger(
          answerData.attempts,
          state.currentQuestionAttempts + 1
        )
      );


    const responseTimeMs =
      answerData.responseTimeMs ??
      (
        state.questionStartedAt
          ? Date.now() -
            state.questionStartedAt
          : 0
      );


    const eventData = {

      type:
        "answer_submitted",

      questionId:
        answerData.questionId ||
        state.currentQuestion
          ?.questionId,

      correct,

      isCorrect:
        correct,

      attempts:
        state.currentQuestionAttempts,

      responseTimeMs:

        safeNumber(
          responseTimeMs,
          0
        ),

      userAnswer:
        answerData.userAnswer ??
        answerData.answer ??
        null,

      correctAnswer:
        answerData.correctAnswer ??
        null,

      skill:
        answerData.skill ||
        state.currentQuestion?.skill ||
        operatorToSkill(
          state.currentQuestion?.op
        ),

      level:
        answerData.level ||
        getCurrentLevel()
    };


    trackEvent(
      "ANSWER_SUBMITTED",
      eventData
    );


    /*
     * CORRECT
     */

    if (correct) {

      state.wrongCount =
        0;

      showCelebrating();


      const local =
        localResponse(
          eventData
        );


      if (answerData.displayResponse !== false) {
        showCupcakeResponse(
          local,
          {
            speak:
              answerData.speak !== false
          }
        );
      }


      sendCupcakeEvent(
        eventData,
        false
      );


      return {

        correct:
          true,

        response:
          local
      };
    }


    /*
     * WRONG
     */

    state.wrongCount++;


    if (
      state.wrongCount === 1
    ) {

      showOops();

    } else {

      showTeaching();
    }


    const local =
      localResponse(
        eventData
      );


    if (answerData.displayResponse !== false) {
      showCupcakeResponse(
        local,
        {
          speak:
            answerData.speak !== false
        }
      );
    }


    sendCupcakeEvent(
      eventData,
      false
    );


    return {

      correct:
        false,

      response:
        local
    };
  }


  /* ============================================================
     SEND CUPCAKE EVENT
     ============================================================ */

  async function sendCupcakeEvent(
    eventData = {},
    displayResponse = true
  ) {

    const result =
      await requestCupcakeAPI(
        eventData
      );


    if (
      !result.success
    ) {

      return result;
    }


    const response =
      normalizeCupcakeResponse(
        result
      );


    if (
      response &&
      displayResponse
    ) {

      showCupcakeResponse(
        response
      );
    }


    if (
      response
    ) {

      state.chatHistory.push({

        role:
          "assistant",

        content:
          response,

        timestamp:
          nowISO()
      });


      if (
        state.chatHistory.length >
        CONFIG.MAX_CHAT_HISTORY
      ) {

        state.chatHistory =
          state.chatHistory.slice(
            -CONFIG.MAX_CHAT_HISTORY
          );
      }
    }


    dispatch(
      "cupcake-api-response",
      {
        response,

        result
      }
    );


    return {

      success:
        true,

      response,

      result
    };
  }


  /* ============================================================
     TUTOR REQUEST
     ============================================================ */

  async function askCupcake(
    message,
    options = {}
  ) {

    const text =
      String(
        message ||
        ""
      ).trim();


    if (!text) {

      return null;
    }


    const profile =
      getProfile();


    trackEvent(
      "TUTOR_REQUEST",
      {
        message:
          text,

        source:
          options.source ||
          "chat",

        skill:
          options.skill ||
          state.currentQuestion?.skill ||
          profile?.recommendedSkill ||
          null
      }
    );


    state.chatHistory.push({

      role:
        "user",

      content:
        text,

      timestamp:
        nowISO()
    });


    showThinking();


    const result =
      await requestCupcakeAPI(
        {
          type:
            "tutor_request",

          message:
            text,

          source:
            options.source ||
            "chat",

          profile,

          question:
            state.currentQuestion,

          history:
            state.chatHistory.slice(
              -CONFIG.MAX_CHAT_HISTORY
            )
        }
      );


    let response =
      normalizeCupcakeResponse(
        result
      );


    if (!response) {

      response =
        localResponse(
          {
            type:
              "tutor_request"
          }
        );
    }


    showTeaching();


    showCupcakeResponse(
      response,
      {
        speak:
          options.speak !== false
      }
    );


    return response;
  }


  /* ============================================================
     WELCOME
     ============================================================ */

  async function startCupcakeWelcome(
    playerId,
    options = {}
  ) {

    state.playerId =
      playerId ||
      resolvePlayerId();


    const info =
      getPlayerInfo();


    state.playerName =
      info.name ||
      options.playerName ||
      "";

    state.playerAge =
      info.age ||
      options.age ||
      null;


    unlockChocolateCupcakeTTS();


    showCupcakeState(
      "welcome"
    );


    const local =
      localResponse(
        {
          type:
            "game_started"
        }
      );


    showCupcakeResponse(
      local,
      {
        speak:
          options.speak !== false
      }
    );


    trackEvent(
      "GAME_STARTED",
      {
        source:
          options.source ||
          "chocolate-abyss-gate",

        playerName:
          state.playerName,

        age:
          state.playerAge
      }
    );


    sendCupcakeEvent(
      {
        type:
          "game_started",

        playerName:
          state.playerName,

        age:
          state.playerAge
      },
      false
    );


    return local;
  }


  /* ============================================================
     LEVEL COMPLETED
     ============================================================ */

  async function sendCupcakeVictory(
    level,
    data = {}
  ) {

    showVictory();


    const profile =
      getProfile();


    trackEvent(
      "LEVEL_COMPLETED",
      {
        level:
          level,

        score:
          data.score,

        steps:
          data.steps,

        accuracy:
          profile?.accuracy,

        totalQuestions:
          profile?.totalQuestions,

        correctAnswers:
          profile?.correctAnswers,

        mistakes:
          profile?.mistakes
      }
    );


    const local =
      localResponse(
        {
          type:
            "level_completed"
        }
      );


    showCupcakeResponse(
      local,
      {
        speak:
          data.speak !== false
      }
    );


    sendCupcakeEvent(
      {
        type:
          "level_completed",

        level,

        score:
          data.score,

        steps:
          data.steps,

        profile
      },
      false
    );


    /*
     * Sync player memory after level completion.
     */

    try {

      if (
        typeof window.syncPlayerMemory ===
        "function"
      ) {

        await window.syncPlayerMemory();
      }

    } catch (_) {}


    return local;
  }


  /* ============================================================
     STT SUPPORT
     ============================================================ */

  function initializeSTT() {

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

      state.sttSupported =
        false;

      console.warn(
        "[Chocolate Cupcake] Speech Recognition not supported."
      );

      return false;
    }


    state.sttSupported =
      true;


    state.recognition =
      new SpeechRecognition();


    state.recognition.lang =
      CONFIG.LANGUAGE;

    state.recognition.continuous =
      false;

    state.recognition.interimResults =
      true;

    state.recognition.maxAlternatives =
      CONFIG.STT_MAX_ALTERNATIVES;


    state.recognition.onstart =
      function () {

        state.listening =
          true;

        dispatch(
          "cupcake-stt-start",
          {
            language:
              CONFIG.LANGUAGE
          }
        );
      };


    state.recognition.onresult =
      function (event) {

        let transcript =
          "";

        for (
          let i =
            event.resultIndex;
          i <
          event.results.length;
          i++
        ) {

          transcript +=
            event.results[i][0]
              .transcript;
        }


        state.speechBuffer =
          transcript.trim();


        dispatch(
          "cupcake-stt-result",
          {
            transcript:
              state.speechBuffer,

            final:
              Boolean(
                event.results[
                  event.results.length - 1
                ].isFinal
              )
          }
        );
      };


    state.recognition.onerror =
      function (event) {

        state.listening =
          false;


        dispatch(
          "cupcake-stt-error",
          {
            error:
              event.error
          }
        );


        console.warn(
          "[Chocolate Cupcake] STT error:",
          event.error
        );
      };


    state.recognition.onend =
      function () {

        state.listening =
          false;


        dispatch(
          "cupcake-stt-end",
          {
            transcript:
              state.speechBuffer
          }
        );


        if (
          state.speechBuffer
        ) {

          const transcript =
            state.speechBuffer;

          state.speechBuffer =
            "";


          trackEvent(
            "STT_REQUEST",
            {
              language:
                CONFIG.LANGUAGE,

              transcript:
                transcript
            }
          );


          /*
           * Automatically send spoken message
           * to Chocolate Cupcake.
           */

          askCupcake(
            transcript,
            {
              source:
                "stt"
            }
          );
        }
      };


    return true;
  }


  /* ============================================================
     START STT
     ============================================================ */

  function startSTT() {

    if (
      !state.sttSupported
    ) {

      initializeSTT();
    }


    if (
      !state.recognition
    ) {

      return {
        success:
          false,

        reason:
          "Speech Recognition tidak tersedia."
      };
    }


    if (
      state.listening
    ) {

      return {
        success:
          false,

        reason:
          "STT sedang aktif."
      };
    }


    state.speechBuffer =
      "";


    showThinking();


    try {

      state.recognition.start();


      return {
        success:
          true
      };

    } catch (error) {

      console.warn(
        "[Chocolate Cupcake] Failed to start STT:",
        error
      );


      return {
        success:
          false,

        reason:
          error.message
      };
    }
  }


  /* ============================================================
     STOP STT
     ============================================================ */

  function stopSTT() {

    if (
      !state.recognition
    ) {

      return false;
    }


    try {

      state.recognition.stop();

      return true;

    } catch (_) {

      return false;
    }
  }


  /* ============================================================
     TTS
     ============================================================ */

  function initializeTTS() {

    state.ttsSupported =
      "speechSynthesis" in window &&
      "SpeechSynthesisUtterance" in window;


    return state.ttsSupported;
  }


  function getIndonesianVoice() {

    if (
      !state.ttsSupported
    ) {

      return null;
    }


    const voices =
      window.speechSynthesis.getVoices();


    if (!voices.length) {

      return null;
    }


    const preferred =
      voices.find(
        voice =>
          voice.lang ===
          "id-ID"
      );


    if (preferred) {

      return preferred;
    }


    return (
      voices.find(
        voice =>
          voice.lang &&
          voice.lang
            .toLowerCase()
            .startsWith("id")
      ) ||
      voices[0]
    );
  }


  function unlockChocolateCupcakeTTS() {

    if (
      !state.ttsSupported
    ) {

      initializeTTS();
    }


    state.ttsUnlocked =
      true;


    try {

      const utterance =
        new SpeechSynthesisUtterance(
          ""
        );

      utterance.lang =
        CONFIG.LANGUAGE;

      utterance.volume =
        0;


      window.speechSynthesis.speak(
        utterance
      );

    } catch (_) {}


    dispatch(
      "cupcake-tts-unlocked"
    );


    return true;
  }


  function speakChocolateCupcake(
    text,
    options = {}
  ) {

    if (
      !text ||
      !state.ttsSupported ||
      state.ttsUnlocked === false
    ) {
      return false;
    }

    try {
      if (typeof window.queueCupcakeSpeech === "function") {
        return window.queueCupcakeSpeech(text, {
          lang: options.lang || CONFIG.LANGUAGE,
          rate: safeNumber(options.rate, 0.88),
          pitch: safeNumber(options.pitch, CONFIG.TTS_PITCH),
          volume: safeNumber(options.volume, CONFIG.TTS_VOLUME)
        });
      }

      const utterance = new SpeechSynthesisUtterance(String(text));
      utterance.lang = options.lang || CONFIG.LANGUAGE;
      utterance.rate = safeNumber(options.rate, 0.88);
      utterance.pitch = safeNumber(options.pitch, CONFIG.TTS_PITCH);
      utterance.volume = safeNumber(options.volume, CONFIG.TTS_VOLUME);
      const voice = getIndonesianVoice();
      if (voice) utterance.voice = voice;
      utterance.onstart = () => { state.speaking = true; dispatch("cupcake-tts-start", {text}); };
      utterance.onend = () => { state.speaking = false; dispatch("cupcake-tts-end"); };
      utterance.onerror = event => { state.speaking = false; dispatch("cupcake-tts-error", {error:event.error}); };
      window.speechSynthesis.speak(utterance);
      return true;
    } catch (error) {
      console.warn("[Chocolate Cupcake] TTS error:", error);
      return false;
    }
  }

  function stopChocolateCupcakeTTS() {

    if (
      !state.ttsSupported
    ) {

      return;
    }


    try {

      window.speechSynthesis.cancel();

    } catch (_) {}


    state.speaking =
      false;
  }


  /* ============================================================
     VISUAL MATH
     ============================================================ */

  function operatorSymbol(
    operator
  ) {

    switch (operator) {

      case "*":
        return "×";

      case "/":
        return "÷";

      default:
        return operator;
    }
  }


  function createVisualMath(
    question = {}
  ) {
    const a = Number(question.a ?? question.left);
    const b = Number(question.b ?? question.right);
    const operator = operatorSymbol(question.op || question.operator || "+");
    if (!Number.isFinite(a) || !Number.isFinite(b)) return "";

    const chocolates = (count, changed=0) => Array.from({length:Math.max(0,Math.min(count,20))}, (_,i) =>
      `<span class="cupcake-math-chocolate ${i>=count-changed?"changed":""}">🍫</span>`).join("");

    if (operator === "−") {
      return `<div class="cupcake-visual-math cupcake-visual-subtraction" data-visual-hold="6500">
        <div class="cupcake-math-title">🧠 Hitung coklat yang tetap</div>
        <div class="cupcake-math-equation">${a} − ${b} = ?</div>
        <div class="cupcake-math-items">${chocolates(a,b)}</div>
        <div class="cupcake-math-help">${b} coklat berubah warna. Hitung coklat yang <b>tidak berubah warna</b>.</div>
      </div>`;
    }

    return `<div class="cupcake-visual-math" data-visual-hold="6500">
      <div class="cupcake-math-number">🍫 ${a}</div>
      <div class="cupcake-math-operator">${operator}</div>
      <div class="cupcake-math-number">🍫 ${b}</div>
      <div class="cupcake-math-equals">= ?</div>
    </div>`;
  }

  /* ============================================================
     INJECT VISUAL MATH CSS
     ============================================================ */

  function injectVisualMathCSS() {

    if (
      document.getElementById(
        "cupcake-visual-math-css"
      )
    ) {

      return;
    }


    const style =
      document.createElement(
        "style"
      );


    style.id =
      "cupcake-visual-math-css";


    style.textContent = `

      .cupcake-visual-math {
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        justify-content:center;
        gap:8px;
        width:100%;
        max-width:100%;
        box-sizing:border-box;
        padding:12px;
        margin:10px 0;
        border-radius:16px;
        background:rgba(255,255,255,.08);
        font-size:22px;
        font-weight:800;
        text-align:center;
        overflow:hidden;
      }

      .cupcake-visual-subtraction {
        display:block;
      }

      .cupcake-math-items {
        display:flex;
        flex-wrap:wrap;
        justify-content:center;
        gap:5px;
        max-width:100%;
        margin:8px auto;
      }

      .cupcake-math-chocolate {
        display:inline-grid;
        place-items:center;
        width:30px;
        height:30px;
        flex:0 0 30px;
        border-radius:8px;
        background:#6b351b;
        border:2px solid #3b1d10;
        font-size:18px;
      }

      .cupcake-math-chocolate.changed {
        background:#9fa6ad;
        border-color:#737a82;
        filter:grayscale(.75);
        opacity:.9;
      }

      .cupcake-math-title {font-size:12px;margin-bottom:4px;color:#ffe7ad}
      .cupcake-math-help {font-size:12px;line-height:1.4;margin-top:5px}

      .cupcake-math-number {
        display:flex;
        align-items:center;
        gap:5px;
      }

      .cupcake-math-operator,
      .cupcake-math-equals {
        font-size:28px;
      }

      .cupcake-stt-active {
        animation: cupcakeSTTPulse 1s infinite;
      }

      @keyframes cupcakeSTTPulse {
        0% {
          transform:scale(1);
        }

        50% {
          transform:scale(1.05);
        }

        100% {
          transform:scale(1);
        }
      }

    `;


    document.head.appendChild(
      style
    );
  }


  /* ============================================================
     LEARNING RESUME
     ============================================================ */

  function getLearningResume() {

    try {

      if (
        typeof window.generatePlayerLearningResume ===
        "function"
      ) {

        return (
          window.generatePlayerLearningResume()
        );
      }

    } catch (error) {

      console.warn(
        "[Chocolate Cupcake] Resume error:",
        error
      );
    }


    const profile =
      getProfile() ||
      {};


    return {

      player:
        getPlayerInfo(),

      performance: {

        totalQuestions:
          profile.totalQuestions || 0,

        correctAnswers:
          profile.correctAnswers || 0,

        mistakes:
          profile.mistakes || 0,

        accuracy:
          profile.accuracy || 0,

        score:
          profile.score || 0,

        steps:
          profile.steps || 0
      },

      skills:
        profile.skills || {},

      recommendedSkill:
        profile.recommendedSkill ||
        null,

      learningStatus:
        profile.learningStatus ||
        "new"
    };
  }


  /* ============================================================
     SHOW LEARNING RESUME
     ============================================================ */

  function showLearningResume() {

    const resume =
      getLearningResume();


    dispatch(
      "cupcake-learning-resume",
      resume
    );


    /*
     * Existing UI hook.
     */

    try {

      if (
        typeof window.showPlayerLearningResume ===
        "function"
      ) {

        window.showPlayerLearningResume(
          resume
        );
      }

    } catch (_) {}


    return resume;
  }


  /* ============================================================
     MEMORY SYNC
     ============================================================ */

  async function syncPlayerMemory() {

    try {

      if (
        typeof window.syncPlayerMemory ===
        "function"
      ) {

        return await window.syncPlayerMemory();
      }

    } catch (error) {

      console.warn(
        "[Chocolate Cupcake] Memory sync error:",
        error
      );
    }


    /*
     * Fallback adapter directly from AI Agent.
     */

    const profile =
      getProfile();


    if (!profile) {

      return {
        success:
          false,

        reason:
          "No learning profile"
      };
    }


    const payload = {

      source:
        "chocolate-abyss-gate",

      type:
        "player_learning_profile",

      playerId:
        state.playerId,

      player:
        getPlayerInfo(),

      profile,

      timestamp:
        nowISO()
    };


    try {

      const response =
        await fetchWithTimeout(
          CONFIG.MEMORY_API,
          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                payload
              )
          },

          CONFIG.MEMORY_TIMEOUT
        );


      if (!response.ok) {

        throw new Error(
          "Memory API HTTP " +
          response.status
        );
      }


      return {
        success:
          true
      };

    } catch (error) {

      console.warn(
        "[Chocolate Cupcake] Memory API unavailable:",
        error
      );


      return {
        success:
          false,

        reason:
          error.message
      };
    }
  }


  /* ============================================================
     CHAT MESSAGE
     ============================================================ */

  async function sendChatMessage(
    message,
    options = {}
  ) {

    return askCupcake(
      message,
      options
    );
  }


  /* ============================================================
     GAME EVENT LISTENER
     ============================================================ */

  function setupGameEventListeners() {

    window.addEventListener(
      "player-event",
      function (event) {

        const data =
          event.detail || {};


        if (
          data.type ===
          "QUESTION_SHOWN"
        ) {

          state.currentQuestion = {

            questionId:
              data.questionId,

            skill:
              data.skill,

            level:
              data.level,

            difficulty:
              data.difficulty,

            a:
              data.a,

            b:
              data.b,

            op:
              data.op ||
              data.operator
          };


          state.currentQuestionAttempts =
            0;

          state.questionStartedAt =
            Date.now();
        }


        if (
          data.type ===
          "LEVEL_COMPLETED"
        ) {

          showCelebrating();
        }


        if (
          data.type ===
          "SESSION_COMPLETED"
        ) {

          showVictory();
        }
      }
    );


    window.addEventListener(
      "learning-resume-generated",
      function () {

        showLearningResume();
      }
    );
  }


  /* ============================================================
     PUBLIC API
     ============================================================ */

  window.ChocolateCupcakeAI = {

    config:
      CONFIG,

    persona:
      CUPCAKE_PERSONA,

    states:
      CUPCAKE_STATES,

    state,

    getProfile,

    getPlayerInfo,

    getCurrentLevel,

    trackEvent,

    startQuestion,

    askCupcakeAfterAnswer,

    askCupcake,

    sendChatMessage,

    sendCupcakeEvent,

    startCupcakeWelcome,

    sendCupcakeVictory,

    requestAIDecision,

    calculateAdaptiveDecision,

    showCupcakeState,

    showCupcakeResponse,

    showThinking,

    showOops,

    showTeaching,

    showEncouraging,

    showCelebrating,

    showVictory,

    startSTT,

    stopSTT,

    initializeSTT,

    speakChocolateCupcake,

    stopChocolateCupcakeTTS,

    unlockChocolateCupcakeTTS,

    initializeTTS,

    createVisualMath,

    getLearningResume,

    showLearningResume,

    syncPlayerMemory,

    getChatHistory:
      function () {
        return [
          ...state.chatHistory
        ];
      },

    clearChatHistory:
      function () {
        state.chatHistory = [];
      }
  };


  /* ============================================================
     BACKWARD COMPATIBILITY API
     ============================================================ */

  window.requestAIDecision =
    requestAIDecision;


  window.requestCupcakeResponse =
    requestCupcakeAPI;


  window.showCupcakeAgentState =
    showCupcakeState;


  window.showCupcakeResponse =
    showCupcakeResponse;


  window.sendCupcakeEvent =
    sendCupcakeEvent;


  window.startCupcakeWelcome =
    startCupcakeWelcome;


  window.sendCupcakeVictory =
    sendCupcakeVictory;


  window.askCupcakeAfterAnswer =
    askCupcakeAfterAnswer;


  window.startChocolateCupcakeSTT =
    startSTT;


  window.stopChocolateCupcakeSTT =
    stopSTT;


  window.speakChocolateCupcake =
    speakChocolateCupcake;


  window.stopChocolateCupcakeTTS =
    stopChocolateCupcakeTTS;


  window.unlockChocolateCupcakeTTS =
    unlockChocolateCupcakeTTS;


  window.getChocolateCupcakeProfile =
    getProfile;


  window.getChocolateCupcakeLearningResume =
    getLearningResume;


  window.syncChocolateCupcakeMemory =
    syncPlayerMemory;


  /* ============================================================
     INITIALIZATION
     ============================================================ */

  function initialize() {

    if (
      state.initialized
    ) {

      return;
    }


    state.playerId =
      resolvePlayerId();


    const info =
      getPlayerInfo();


    state.playerName =
      info.name ||
      "";

    state.playerAge =
      info.age ||
      null;


    initializeTTS();

    initializeSTT();

    injectVisualMathCSS();

    setupGameEventListeners();


    state.initialized =
      true;


    dispatch(
      "chocolate-cupcake-ready",
      {

        playerId:
          state.playerId,

        playerName:
          state.playerName,

        sttSupported:
          state.sttSupported,

        ttsSupported:
          state.ttsSupported
      }
    );


    console.log(
      "%c🍫 Chocolate Cupcake AI Agent Ready",
      "font-weight:bold;"
    );


    console.log(
      "[Chocolate Cupcake] Persona:",
      CUPCAKE_PERSONA
    );


    console.log(
      "[Chocolate Cupcake] STT supported:",
      state.sttSupported
    );


    console.log(
      "[Chocolate Cupcake] TTS supported:",
      state.ttsSupported
    );
  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );

  } else {

    initialize();
  }

})();
