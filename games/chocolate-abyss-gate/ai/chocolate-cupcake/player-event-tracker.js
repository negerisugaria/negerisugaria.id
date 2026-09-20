/* ============================================================
   CHOCOLATE ABYSS GATE
   PLAYER EVENT TRACKER
   ============================================================

   Purpose:
   - Track player learning events
   - Build PlayerLearningProfile
   - Track skill performance
   - Track score / steps / attempts
   - Support Chocolate Cupcake AI Agent
   - Support STT / TTS events
   - Sync learning data to backend / OpenClaw Memory adapter
   - Keep localStorage as offline fallback

   Compatible with:
   - index.html
   - ai-agent.js
   - Chocolate Cupcake AI Agent
   - PlayerLearningProfile
   ============================================================ */

(function () {
  "use strict";

  /* ============================================================
     CONFIGURATION
     ============================================================ */

  const EVENT_VERSION = 3;

  const DATA_KEY = "chocolateAbyssPlayerData";
  const PLAYER_KEY = "chocolateAbyssPlayerId";
  const PROFILE_KEY = "chocolateAbyssLearningProfile";
  const SESSION_KEY = "chocolateAbyssSessionId";

  /*
   Backend adapter.

   IMPORTANT:
   This is NOT assumed to be a native OpenClaw browser API.

   Your backend should receive these requests and then persist
   them into the OpenClaw memory layer.
  */
  const MEMORY_API =
    window.CHOCOLATE_MEMORY_API ||
    "https://api.negerisugaria.id/api/memory";

  const MEMORY_API_TIMEOUT = 8000;

  /*
   Number of events kept in localStorage.

   This prevents localStorage from growing indefinitely.
  */
  const MAX_EVENTS = 2000;

  /*
   Send accumulated events to backend after this many events.
  */
  const SYNC_BATCH_SIZE = 5;

  /*
   Automatic sync interval.
  */
  const SYNC_INTERVAL = 30000;


  /* ============================================================
     HELPERS
     ============================================================ */

  function id(prefix) {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);

    return Number.isFinite(n) ? n : fallback;
  }

  function safeInteger(value, fallback = 0) {
    const n = parseInt(value, 10);

    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalizeName(name) {
    return String(name || "").trim().slice(0, 100);
  }

  function normalizeAge(age) {
    const value = safeInteger(age, 0);

    if (value <= 0) {
      return null;
    }

    return clamp(value, 3, 100);
  }

  function load(key = DATA_KEY) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) {
        return null;
      }

      return JSON.parse(raw);
    } catch (error) {
      console.warn(
        "[Player Event Tracker] Failed to load local data:",
        error
      );

      return null;
    }
  }

  function saveData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (error) {
      console.warn(
        "[Player Event Tracker] Failed to save local data:",
        error
      );

      return false;
    }
  }

  function removeData(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(
        "[Player Event Tracker] Failed to remove local data:",
        error
      );
    }
  }

  function getCurrentLevel() {
    try {
      if (typeof window.getCurrentGameLevel === "function") {
        return window.getCurrentGameLevel();
      }
    } catch (error) {
      console.warn(
        "[Player Event Tracker] getCurrentGameLevel failed:",
        error
      );
    }

    return null;
  }

  function normalizeLevel(level) {
    return (
      level ||
      getCurrentLevel() ||
      window.levelKey ||
      window.currentLevel ||
      null
    );
  }

  function normalizeSkill(skill) {
    if (!skill) {
      return "general_math";
    }

    const value = String(skill)
      .toLowerCase()
      .trim();

    const aliases = {
      addition: "addition",
      add: "addition",
      "+": "addition",

      subtraction: "subtraction",
      subtract: "subtraction",
      minus: "subtraction",
      "-": "subtraction",

      multiplication: "multiplication",
      multiply: "multiplication",
      times: "multiplication",
      "×": "multiplication",
      "*": "multiplication",

      division: "division",
      divide: "division",
      "÷": "division",
      "/": "division",

      fractions: "fractions",
      fraction: "fractions",

      patterns: "patterns",
      pattern: "patterns",

      geometry: "geometry",
      shapes: "geometry",

      time: "time"
    };

    return aliases[value] || value;
  }

  function getOperatorSkill(operator) {
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

  function emit(name, detail = {}) {
    try {
      window.dispatchEvent(
        new CustomEvent(name, {
          detail
        })
      );
    } catch (error) {
      console.warn(
        "[Player Event Tracker] Event dispatch failed:",
        error
      );
    }
  }


  /* ============================================================
     PLAYER EVENT TRACKER
     ============================================================ */

  class PlayerEventTracker {

    constructor(options = {}) {

      this.options = options;

      this.storageKey =
        options.storageKey ||
        DATA_KEY;

      this.memoryApi =
        options.memoryApi ||
        MEMORY_API;

      this.memoryApiTimeout =
        safeInteger(
          options.memoryApiTimeout,
          MEMORY_API_TIMEOUT
        );

      this.syncBatchSize =
        safeInteger(
          options.syncBatchSize,
          SYNC_BATCH_SIZE
        );

      /* --------------------------------------------------------
         PLAYER ID
         -------------------------------------------------------- */

      this.playerId =
        localStorage.getItem(PLAYER_KEY) ||
        id("player");

      localStorage.setItem(
        PLAYER_KEY,
        this.playerId
      );


      /* --------------------------------------------------------
         SESSION ID
         -------------------------------------------------------- */

      this.sessionId =
        localStorage.getItem(SESSION_KEY) ||
        id("session");

      localStorage.setItem(
        SESSION_KEY,
        this.sessionId
      );


      /* --------------------------------------------------------
         EXISTING DATA
         -------------------------------------------------------- */

      const existing =
        load(this.storageKey) ||
        {};


      /* --------------------------------------------------------
         PLAYER INFO
         -------------------------------------------------------- */

      this.playerInfo =
        existing.playerInfo ||
        {
          playerId: this.playerId,
          name: "",
          age: null
        };


      /* --------------------------------------------------------
         LEARNING DATA
         -------------------------------------------------------- */

      this.learning =
        existing.learning ||
        this.createEmptyLearning();


      /* --------------------------------------------------------
         EVENTS
         -------------------------------------------------------- */

      this.data = {

        version: EVENT_VERSION,

        playerId:
          this.playerId,

        sessionId:
          this.sessionId,

        playerInfo:
          this.playerInfo,

        learning:
          this.learning,

        events:
          Array.isArray(existing.events)
            ? existing.events
            : [],

        sync:
          existing.sync ||
          {
            lastSyncAt: null,
            pendingEvents: 0,
            lastSyncStatus: "never"
          },

        createdAt:
          existing.createdAt ||
          nowISO(),

        updatedAt:
          nowISO()
      };


      /* --------------------------------------------------------
         PROFILE
         -------------------------------------------------------- */

      this.learningProfile =
        this.buildLearningProfile();


      this.save();


      /* --------------------------------------------------------
         AUTO SYNC
         -------------------------------------------------------- */

      this.startAutoSync();


      console.log(
        "[Player Event Tracker] Initialized",
        {
          playerId: this.playerId,
          sessionId: this.sessionId
        }
      );
    }


    /* ==========================================================
       EMPTY LEARNING OBJECT
       ========================================================== */

    createEmptyLearning() {

      return {

        totalQuestions: 0,

        correctAnswers: 0,

        mistakes: 0,

        attempts: 0,

        hintsUsed: 0,

        tutorRequests: 0,

        sttRequests: 0,

        aiDecisions: 0,

        totalResponseTimeMs: 0,

        score: 0,

        steps: 0,

        levelsStarted: 0,

        levelsCompleted: 0,

        sessionsStarted: 0,

        sessionsCompleted: 0,

        currentLevel: null,

        highestLevelCompleted: null,

        accuracy: 0,

        averageResponseTimeMs: 0,

        skills: {},

        recentQuestions: [],

        recentMistakes: [],

        recentAnswers: [],

        lastQuestion: null,

        lastAnswer: null,

        lastMistake: null,

        lastAIdecision: null,

        lastActivityAt: null
      };
    }


    /* ==========================================================
       FIX INVALID PROPERTY NAME
       ========================================================== */

    normalizeLearningObject() {

      if (!this.learning) {
        this.learning =
          this.createEmptyLearning();
      }

      if (
        typeof this.learning.skills !==
        "object" ||
        Array.isArray(this.learning.skills)
      ) {
        this.learning.skills = {};
      }

      if (
        !Array.isArray(
          this.learning.recentQuestions
        )
      ) {
        this.learning.recentQuestions = [];
      }

      if (
        !Array.isArray(
          this.learning.recentMistakes
        )
      ) {
        this.learning.recentMistakes = [];
      }

      if (
        !Array.isArray(
          this.learning.recentAnswers
        )
      ) {
        this.learning.recentAnswers = [];
      }
    }


    /* ==========================================================
       SAVE
       ========================================================== */

    save() {

      this.normalizeLearningObject();

      this.data.learning =
        this.learning;

      this.data.playerInfo =
        this.playerInfo;

      this.data.sessionId =
        this.sessionId;

      this.data.updatedAt =
        nowISO();

      this.learningProfile =
        this.buildLearningProfile();

      this.data.learningProfile =
        this.learningProfile;

      saveData(
        this.storageKey,
        this.data
      );

      saveData(
        PROFILE_KEY,
        this.learningProfile
      );

      return this.data;
    }


    /* ==========================================================
       START SESSION
       ========================================================== */

    startSession(options = {}) {

      this.sessionId =
        id("session");

      localStorage.setItem(
        SESSION_KEY,
        this.sessionId
      );

      this.data.sessionId =
        this.sessionId;

      this.learning.sessionsStarted++;

      if (options.resetLearning === true) {

        this.learning =
          this.createEmptyLearning();
      }

      this.save();

      this.track(
        "SESSION_STARTED",
        {
          source:
            options.source ||
            "game"
        }
      );

      return this.sessionId;
    }


    /* ==========================================================
       END SESSION
       ========================================================== */

    endSession(options = {}) {

      this.learning.sessionsCompleted++;

      this.track(
        "SESSION_COMPLETED",
        {
          reason:
            options.reason ||
            "normal",

          durationMs:
            safeNumber(
              options.durationMs,
              0
            )
        }
      );

      this.save();

      this.syncToMemory();

      return this.getLearningProfile();
    }


    /* ==========================================================
       PLAYER INFO
       ========================================================== */

    setPlayerInfo(name, age) {

      this.playerInfo = {

        playerId:
          this.playerId,

        name:
          normalizeName(name),

        age:
          normalizeAge(age)
      };

      this.data.playerInfo =
        this.playerInfo;

      this.save();

      this.track(
        "PLAYER_PROFILE_SET",
        {
          name:
            this.playerInfo.name,

          age:
            this.playerInfo.age
        }
      );

      return this.getPlayerInfo();
    }


    getPlayerInfo() {

      return {
        ...this.playerInfo
      };
    }


    /* ==========================================================
       QUESTION ID
       ========================================================== */

    makeQuestionId(
      level,
      index,
      q
    ) {

      if (!q) {
        return id("question");
      }

      return (
        String(level || "level") +
        "_q" +
        String(
          safeInteger(index, 0) + 1
        ) +
        "_" +
        String(q.a) +
        String(q.op) +
        String(q.b) +
        "_" +
        Date.now().toString(36)
      );
    }


    /* ==========================================================
       GENERIC EVENT TRACKING
       ========================================================== */

    track(type, payload = {}) {

      const currentLevel =
        normalizeLevel(
          payload.level
        );

      const event = {

        eventId:
          id("evt"),

        eventVersion:
          EVENT_VERSION,

        type:
          String(type || "UNKNOWN"),

        playerId:
          this.playerId,

        sessionId:
          this.sessionId,

        timestamp:
          payload.timestamp ||
          nowISO(),

        level:
          currentLevel,

        difficulty:
          payload.difficulty ||
          currentLevel,

        ...payload
      };


      /* --------------------------------------------------------
         EVENT STORAGE
         -------------------------------------------------------- */

      this.data.events.push(
        event
      );


      /* --------------------------------------------------------
         LIMIT LOCAL STORAGE
         -------------------------------------------------------- */

      if (
        this.data.events.length >
        MAX_EVENTS
      ) {

        this.data.events =
          this.data.events.slice(
            -MAX_EVENTS
          );
      }


      /* --------------------------------------------------------
         LAST ACTIVITY
         -------------------------------------------------------- */

      this.learning.lastActivityAt =
        event.timestamp;


      /* --------------------------------------------------------
         EVENT-SPECIFIC PROCESSING
         -------------------------------------------------------- */

      this.processEvent(
        event
      );


      /* --------------------------------------------------------
         SAVE
         -------------------------------------------------------- */

      this.save();


      /* --------------------------------------------------------
         BROWSER EVENT
         -------------------------------------------------------- */

      emit(
        "player-event",
        event
      );


      /* --------------------------------------------------------
         CONSOLE
         -------------------------------------------------------- */

      console.log(
        "[Player Event Tracker]",
        event
      );


      /* --------------------------------------------------------
         AUTOMATIC SYNC
         -------------------------------------------------------- */

      if (
        this.getPendingEvents().length >=
        this.syncBatchSize
      ) {

        this.syncToMemory();
      }


      return event;
    }


    /* ==========================================================
       PROCESS EVENT
       ========================================================== */

    processEvent(event) {

      switch (
        String(event.type || "").toUpperCase()
      ) {

        case "QUESTION_SHOWN":
          this.processQuestionShown(event);
          break;

        case "ANSWER_SUBMITTED":
          this.processAnswerSubmitted(event);
          break;

        case "QUESTION_COMPLETED":
          this.processQuestionCompleted(event);
          break;

        case "HINT_USED":
          this.learning.hintsUsed++;
          break;

        case "TUTOR_REQUEST":
          this.learning.tutorRequests++;
          break;

        case "STT_REQUEST":
          this.learning.sttRequests++;
          break;

        case "AI_DECISION":
          this.learning.aiDecisions++;
          this.learning.lastAIdecision =
            event.decision ||
            null;
          break;

        case "LEVEL_STARTED":
          this.learning.levelsStarted++;
          this.learning.currentLevel =
            event.level ||
            this.learning.currentLevel;
          break;

        case "LEVEL_COMPLETED":
          this.learning.levelsCompleted++;

          this.learning.currentLevel =
            event.nextLevel ||
            event.level ||
            this.learning.currentLevel;

          this.learning.highestLevelCompleted =
            this.getHighestLevel(
              event.level ||
              this.learning.highestLevelCompleted
            );

          break;

        case "SCORE_UPDATED":
          this.learning.score =
            safeNumber(
              event.score,
              this.learning.score
            );
          break;

        case "STEPS_UPDATED":
          this.learning.steps =
            safeNumber(
              event.steps,
              this.learning.steps
            );
          break;

        default:
          break;
      }
    }


    /* ==========================================================
       QUESTION SHOWN
       ========================================================== */

    processQuestionShown(event) {

      const skill =
        normalizeSkill(
          event.skill ||
          getOperatorSkill(
            event.operator ||
            event.op
          )
        );

      event.skill =
        skill;

      this.learning.lastQuestion = {
        questionId:
          event.questionId ||
          null,

        skill:
          skill,

        level:
          event.level ||
          null,

        difficulty:
          event.difficulty ||
          null,

        shownAt:
          event.timestamp
      };

      this.learning.recentQuestions.push({
        questionId:
          event.questionId ||
          null,

        skill:
          skill,

        level:
          event.level ||
          null,

        timestamp:
          event.timestamp
      });

      this.limitRecentArrays();
    }


    /* ==========================================================
       ANSWER SUBMITTED
       ========================================================== */

    processAnswerSubmitted(event) {

      const isCorrect =
        Boolean(
          event.correct === true ||
          event.isCorrect === true
        );

      const skill =
        normalizeSkill(
          event.skill ||
          getOperatorSkill(
            event.operator ||
            event.op
          )
        );


      /* --------------------------------------------------------
         QUESTIONS
         -------------------------------------------------------- */

      this.learning.totalQuestions++;


      /* --------------------------------------------------------
         ATTEMPTS
         -------------------------------------------------------- */

      const attempts =
        Math.max(
          1,
          safeInteger(
            event.attempts,
            1
          )
        );

      this.learning.attempts +=
        attempts;


      /* --------------------------------------------------------
         CORRECT / MISTAKES
         -------------------------------------------------------- */

      if (isCorrect) {

        this.learning.correctAnswers++;

      } else {

        this.learning.mistakes++;

        this.learning.recentMistakes.push({

          questionId:
            event.questionId ||
            null,

          skill:
            skill,

          level:
            event.level ||
            null,

          attempts:
            attempts,

          timestamp:
            event.timestamp,

          userAnswer:
            event.userAnswer ??
            null,

          correctAnswer:
            event.correctAnswer ??
            null
        });
      }


      /* --------------------------------------------------------
         RESPONSE TIME
         -------------------------------------------------------- */

      const responseTime =
        safeNumber(
          event.responseTimeMs ??
          event.responseTime,
          0
        );

      if (responseTime > 0) {

        this.learning.totalResponseTimeMs +=
          responseTime;
      }


      /* --------------------------------------------------------
         RECENT ANSWERS
         -------------------------------------------------------- */

      this.learning.recentAnswers.push({

        questionId:
          event.questionId ||
          null,

        skill:
          skill,

        correct:
          isCorrect,

        attempts:
          attempts,

        responseTimeMs:
          responseTime,

        timestamp:
          event.timestamp
      });


      /* --------------------------------------------------------
         SKILL TRACKING
         -------------------------------------------------------- */

      this.updateSkillStats(
        skill,
        {
          correct:
            isCorrect,

          attempts:
            attempts,

          responseTimeMs:
            responseTime,

          mistake:
            !isCorrect
        }
      );


      /* --------------------------------------------------------
         LAST ANSWER
         -------------------------------------------------------- */

      this.learning.lastAnswer = {

        questionId:
          event.questionId ||
          null,

        skill:
          skill,

        correct:
          isCorrect,

        attempts:
          attempts,

        responseTimeMs:
          responseTime,

        timestamp:
          event.timestamp
      };


      /* --------------------------------------------------------
         GLOBAL ACCURACY
         -------------------------------------------------------- */

      this.updateGlobalAccuracy();
    }


    /* ==========================================================
       QUESTION COMPLETED
       ========================================================== */

    processQuestionCompleted(event) {

      const score =
        event.score;

      if (
        score !== undefined &&
        score !== null
      ) {

        this.learning.score =
          safeNumber(
            score,
            this.learning.score
          );
      }

      const steps =
        event.steps;

      if (
        steps !== undefined &&
        steps !== null
      ) {

        this.learning.steps =
          safeNumber(
            steps,
            this.learning.steps
          );
      }
    }


    /* ==========================================================
       SKILL STATS
       ========================================================== */

    updateSkillStats(
      skill,
      result
    ) {

      const normalizedSkill =
        normalizeSkill(
          skill
        );

      if (
        !this.learning.skills[
          normalizedSkill
        ]
      ) {

        this.learning.skills[
          normalizedSkill
        ] = {

          questions:
            0,

          correct:
            0,

          mistakes:
            0,

          attempts:
            0,

          accuracy:
            0,

          totalResponseTimeMs:
            0,

          averageResponseTimeMs:
            0,

          lastUpdatedAt:
            null
        };
      }

      const stats =
        this.learning.skills[
          normalizedSkill
        ];


      stats.questions++;

      stats.attempts +=
        safeInteger(
          result.attempts,
          1
        );


      if (result.correct) {

        stats.correct++;

      } else {

        stats.mistakes++;
      }


      const responseTime =
        safeNumber(
          result.responseTimeMs,
          0
        );

      stats.totalResponseTimeMs +=
        responseTime;


      stats.accuracy =
        stats.questions > 0
          ? Number(
              (
                stats.correct /
                stats.questions
              ).toFixed(4)
            )
          : 0;


      stats.averageResponseTimeMs =
        stats.questions > 0
          ? Math.round(
              stats.totalResponseTimeMs /
              stats.questions
            )
          : 0;


      stats.lastUpdatedAt =
        nowISO();
    }


    /* ==========================================================
       GLOBAL ACCURACY
       ========================================================== */

    updateGlobalAccuracy() {

      if (
        this.learning.totalQuestions <= 0
      ) {

        this.learning.accuracy = 0;

        return;
      }

      this.learning.accuracy =
        Number(
          (
            this.learning.correctAnswers /
            this.learning.totalQuestions
          ).toFixed(4)
        );


      this.learning.averageResponseTimeMs =
        this.learning.totalQuestions > 0
          ? Math.round(
              this.learning.totalResponseTimeMs /
              this.learning.totalQuestions
            )
          : 0;
    }


    /* ==========================================================
       RECENT ARRAY LIMIT
       ========================================================== */

    limitRecentArrays() {

      const limit = 20;

      this.learning.recentQuestions =
        this.learning.recentQuestions.slice(
          -limit
        );

      this.learning.recentMistakes =
        this.learning.recentMistakes.slice(
          -limit
        );

      this.learning.recentAnswers =
        this.learning.recentAnswers.slice(
          -limit
        );
    }


    /* ==========================================================
       HIGHEST LEVEL
       ========================================================== */

    getHighestLevel(level) {

      const order = {
        easy: 1,
        medium: 2,
        hard: 3
      };

      const current =
        String(
          level || ""
        ).toLowerCase();

      const previous =
        String(
          this.learning.highestLevelCompleted ||
          ""
        ).toLowerCase();

      if (!current) {
        return (
          this.learning.highestLevelCompleted ||
          null
        );
      }

      if (!previous) {
        return current;
      }

      return order[current] >= order[previous]
        ? current
        : previous;
    }


    /* ==========================================================
       GET EVENTS
       ========================================================== */

    getEvents() {

      return [
        ...this.data.events
      ];
    }


    /* ==========================================================
       GET EVENTS BY TYPE
       ========================================================== */

    getEventsByType(type) {

      return this.data.events.filter(
        event =>
          event.type === type
      );
    }


    /* ==========================================================
       GET RECENT EVENTS
       ========================================================== */

    getRecentEvents(limit = 20) {

      return this.data.events.slice(
        -Math.max(
          1,
          safeInteger(limit, 20)
        )
      );
    }


    /* ==========================================================
       GET LEARNING PROFILE
       ========================================================== */

    getLearningProfile() {

      this.learningProfile =
        this.buildLearningProfile();

      return {
        ...this.learningProfile
      };
    }


    /* ==========================================================
       BUILD LEARNING PROFILE
       ========================================================== */

    buildLearningProfile() {

      this.updateGlobalAccuracy();

      const skills =
        {};

      Object.keys(
        this.learning.skills || {}
      ).forEach(skill => {

        const data =
          this.learning.skills[
            skill
          ];

        skills[skill] = {

          questions:
            safeInteger(
              data.questions,
              0
            ),

          correct:
            safeInteger(
              data.correct,
              0
            ),

          mistakes:
            safeInteger(
              data.mistakes,
              0
            ),

          attempts:
            safeInteger(
              data.attempts,
              0
            ),

          accuracy:
            Number(
              safeNumber(
                data.accuracy,
                0
              )
            ),

          averageResponseTimeMs:
            safeNumber(
              data.averageResponseTimeMs,
              0
            )
        };
      });


      const recommendedSkill =
        this.getRecommendedSkill(
          skills
        );


      const learningStatus =
        this.getLearningStatus();


      return {

        profileVersion:
          1,

        playerId:
          this.playerId,

        playerName:
          this.playerInfo.name,

        age:
          this.playerInfo.age,

        sessionId:
          this.sessionId,

        totalQuestions:
          this.learning.totalQuestions,

        correctAnswers:
          this.learning.correctAnswers,

        mistakes:
          this.learning.mistakes,

        attempts:
          this.learning.attempts,

        accuracy:
          this.learning.accuracy,

        averageResponseTimeMs:
          this.learning.averageResponseTimeMs,

        score:
          this.learning.score,

        steps:
          this.learning.steps,

        levelsStarted:
          this.learning.levelsStarted,

        levelsCompleted:
          this.learning.levelsCompleted,

        highestLevelCompleted:
          this.learning.highestLevelCompleted,

        currentLevel:
          this.learning.currentLevel,

        hintsUsed:
          this.learning.hintsUsed,

        tutorRequests:
          this.learning.tutorRequests,

        sttRequests:
          this.learning.sttRequests,

        aiDecisions:
          this.learning.aiDecisions,

        skills:
          skills,

        recommendedSkill:
          recommendedSkill,

        learningStatus:
          learningStatus,

        recentMistakes:
          this.learning.recentMistakes.slice(-5),

        lastQuestion:
          this.learning.lastQuestion,

        lastAnswer:
          this.learning.lastAnswer,

        lastAIdecision:
          this.learning.lastAIdecision,

        lastActivityAt:
          this.learning.lastActivityAt,

        generatedAt:
          nowISO()
      };
    }


    /* ==========================================================
       RECOMMENDED SKILL
       ========================================================== */

    getRecommendedSkill(
      skills = this.learning.skills
    ) {

      const entries =
        Object.entries(
          skills || {}
        );

      if (!entries.length) {

        return null;
      }


      /*
       Priority:
       1. lowest accuracy
       2. more mistakes
       3. more questions
      */

      entries.sort(
        (a, b) => {

          const A = a[1];
          const B = b[1];

          const accuracyDifference =
            safeNumber(
              A.accuracy,
              0
            ) -
            safeNumber(
              B.accuracy,
              0
            );

          if (
            accuracyDifference !== 0
          ) {

            return accuracyDifference;
          }


          const mistakeDifference =
            safeNumber(
              B.mistakes,
              0
            ) -
            safeNumber(
              A.mistakes,
              0
            );

          if (
            mistakeDifference !== 0
          ) {

            return mistakeDifference;
          }


          return (
            safeNumber(
              B.questions,
              0
            ) -
            safeNumber(
              A.questions,
              0
            )
          );
        }
      );


      return entries[0][0];
    }


    /* ==========================================================
       LEARNING STATUS
       ========================================================== */

    getLearningStatus() {

      const accuracy =
        safeNumber(
          this.learning.accuracy,
          0
        );

      const mistakes =
        safeNumber(
          this.learning.mistakes,
          0
        );


      if (
        this.learning.totalQuestions === 0
      ) {

        return "new";
      }


      if (
        accuracy < 0.5 ||
        mistakes >= 3
      ) {

        return "needs_support";
      }


      if (
        accuracy < 0.7
      ) {

        return "developing";
      }


      if (
        accuracy < 0.9
      ) {

        return "progressing";
      }


      return "strong";
    }


    /* ==========================================================
       QUESTION CONTEXT
       ========================================================== */

    getCurrentLearningContext() {

      return {

        player:
          this.getPlayerInfo(),

        profile:
          this.getLearningProfile(),

        recentEvents:
          this.getRecentEvents(10)
      };
    }


    /* ==========================================================
       PENDING EVENTS
       ========================================================== */

    getPendingEvents() {

      const lastSyncAt =
        this.data.sync &&
        this.data.sync.lastSyncAt;

      if (!lastSyncAt) {

        return [
          ...this.data.events
        ];
      }

      return this.data.events.filter(
        event =>
          event.timestamp >
          lastSyncAt
      );
    }


    /* ==========================================================
       BUILD MEMORY PAYLOAD
       ========================================================== */

    buildMemoryPayload() {

      return {

        memoryVersion:
          1,

        source:
          "chocolate-abyss-gate",

        type:
          "player_learning_profile",

        playerId:
          this.playerId,

        sessionId:
          this.sessionId,

        player:
          this.getPlayerInfo(),

        profile:
          this.getLearningProfile(),

        recentEvents:
          this.getRecentEvents(20),

        timestamp:
          nowISO()
      };
    }


    /* ==========================================================
       REQUEST WITH TIMEOUT
       ========================================================== */

    async fetchWithTimeout(
      url,
      options = {},
      timeout =
        this.memoryApiTimeout
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

        clearTimeout(
          timer
        );
      }
    }


    /* ==========================================================
       SYNC TO MEMORY
       ========================================================== */

    async syncToMemory(
      options = {}
    ) {

      if (
        !this.memoryApi
      ) {

        return {
          success: false,
          reason:
            "memory_api_not_configured"
        };
      }


      const payload =
        this.buildMemoryPayload();


      try {

        const response =
          await this.fetchWithTimeout(
            this.memoryApi,
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
            }
          );


        if (!response.ok) {

          throw new Error(
            "Memory API HTTP " +
            response.status
          );
        }


        let result =
          null;

        try {

          result =
            await response.json();

        } catch (_) {

          result = {
            success: true
          };
        }


        this.data.sync = {

          lastSyncAt:
            nowISO(),

          pendingEvents:
            0,

          lastSyncStatus:
            "success"
        };


        this.save();


        emit(
          "player-memory-synced",
          {
            playerId:
              this.playerId,

            profile:
              this.getLearningProfile(),

            result:
              result
          }
        );


        console.log(
          "[Player Event Tracker] Memory synced",
          result
        );


        return {

          success:
            true,

          result:
            result
        };

      } catch (error) {

        this.data.sync = {

          ...(this.data.sync || {}),

          pendingEvents:
            this.getPendingEvents().length,

          lastSyncStatus:
            "failed",

          lastError:
            error.message
        };


        this.save();


        console.warn(
          "[Player Event Tracker] Memory sync failed. Local data remains available.",
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


    /* ==========================================================
       AUTO SYNC
       ========================================================== */

    startAutoSync() {

      if (
        this.autoSyncTimer
      ) {

        clearInterval(
          this.autoSyncTimer
        );
      }


      this.autoSyncTimer =
        setInterval(
          () => {

            if (
              this.getPendingEvents()
                .length > 0
            ) {

              this.syncToMemory();
            }

          },
          SYNC_INTERVAL
        );
    }


    /* ==========================================================
       STOP AUTO SYNC
       ========================================================== */

    stopAutoSync() {

      if (
        this.autoSyncTimer
      ) {

        clearInterval(
          this.autoSyncTimer
        );

        this.autoSyncTimer =
          null;
      }
    }


    /* ==========================================================
       SCORE / STEPS
       ========================================================== */

    updateGameStats(
      score,
      steps,
      level
    ) {

      this.learning.score =
        safeNumber(
          score,
          this.learning.score
        );

      this.learning.steps =
        safeNumber(
          steps,
          this.learning.steps
        );

      this.learning.currentLevel =
        level ||
        this.learning.currentLevel;

      this.track(
        "GAME_STATS_UPDATED",
        {
          score:
            this.learning.score,

          steps:
            this.learning.steps,

          level:
            this.learning.currentLevel
        }
      );

      return {
        score:
          this.learning.score,

        steps:
          this.learning.steps
      };
    }


    /* ==========================================================
       LEVEL START
       ========================================================== */

    trackLevelStarted(
      level,
      payload = {}
    ) {

      return this.track(
        "LEVEL_STARTED",
        {
          ...payload,

          level:
            level,

          timestamp:
            payload.timestamp ||
            nowISO()
        }
      );
    }


    /* ==========================================================
       LEVEL COMPLETE
       ========================================================== */

    trackLevelCompleted(
      level,
      payload = {}
    ) {

      const event =
        this.track(
          "LEVEL_COMPLETED",
          {
            ...payload,

            level:
              level,

            score:
              payload.score ??
              this.learning.score,

            steps:
              payload.steps ??
              this.learning.steps,

            accuracy:
              this.learning.accuracy,

            totalQuestions:
              this.learning.totalQuestions,

            correctAnswers:
              this.learning.correctAnswers,

            mistakes:
              this.learning.mistakes
          }
        );


      /*
       * Sync after every completed level.
       */
      this.syncToMemory();


      return event;
    }


    /* ==========================================================
       QUESTION SHOWN
       ========================================================== */

    trackQuestionShown(
      payload = {}
    ) {

      const questionId =
        payload.questionId ||
        this.makeQuestionId(
          payload.level,
          payload.index,
          {
            a:
              payload.a ??
              payload.left ??
              "",

            op:
              payload.op ??
              payload.operator ??
              "",

            b:
              payload.b ??
              payload.right ??
              ""
          }
        );


      return this.track(
        "QUESTION_SHOWN",
        {
          ...payload,

          questionId:
            questionId,

          skill:
            normalizeSkill(
              payload.skill ||
              getOperatorSkill(
                payload.op ||
                payload.operator
              )
            )
        }
      );
    }


    /* ==========================================================
       ANSWER SUBMITTED
       ========================================================== */

    trackAnswerSubmitted(
      payload = {}
    ) {

      const skill =
        normalizeSkill(
          payload.skill ||
          getOperatorSkill(
            payload.op ||
            payload.operator
          )
        );


      return this.track(
        "ANSWER_SUBMITTED",
        {
          ...payload,

          skill:
            skill,

          correct:
            Boolean(
              payload.correct === true ||
              payload.isCorrect === true
            ),

          attempts:
            Math.max(
              1,
              safeInteger(
                payload.attempts,
                1
              )
            ),

          responseTimeMs:
            safeNumber(
              payload.responseTimeMs ??
              payload.responseTime,
              0
            )
        }
      );
    }


    /* ==========================================================
       HINT USED
       ========================================================== */

    trackHintUsed(
      payload = {}
    ) {

      return this.track(
        "HINT_USED",
        {
          ...payload,

          hintType:
            payload.hintType ||
            "cupcake"
        }
      );
    }


    /* ==========================================================
       AI DECISION
       ========================================================== */

    trackAIDecision(
      payload = {}
    ) {

      return this.track(
        "AI_DECISION",
        {
          ...payload,

          decision:
            payload.decision ||
            null,

          reason:
            payload.reason ||
            null
        }
      );
    }


    /* ==========================================================
       TUTOR REQUEST
       ========================================================== */

    trackTutorRequest(
      payload = {}
    ) {

      return this.track(
        "TUTOR_REQUEST",
        {
          ...payload,

          source:
            payload.source ||
            "chocolate-cupcake"
        }
      );
    }


    /* ==========================================================
       STT REQUEST
       ========================================================== */

    trackSTTRequest(
      payload = {}
    ) {

      return this.track(
        "STT_REQUEST",
        {
          ...payload,

          language:
            payload.language ||
            "id-ID"
        }
      );
    }


    /* ==========================================================
       LEARNING RESUME
       ========================================================== */

    generateLearningResume() {

      const profile =
        this.getLearningProfile();


      const resume = {

        resumeVersion:
          1,

        generatedAt:
          nowISO(),

        player:
          {
            playerId:
              profile.playerId,

            name:
              profile.playerName,

            age:
              profile.age
          },

        performance:
          {
            totalQuestions:
              profile.totalQuestions,

            correctAnswers:
              profile.correctAnswers,

            mistakes:
              profile.mistakes,

            attempts:
              profile.attempts,

            accuracy:
              profile.accuracy,

            score:
              profile.score,

            steps:
              profile.steps
          },

        progression:
          {
            levelsStarted:
              profile.levelsStarted,

            levelsCompleted:
              profile.levelsCompleted,

            highestLevelCompleted:
              profile.highestLevelCompleted,

            currentLevel:
              profile.currentLevel
          },

        skills:
          profile.skills,

        recommendedSkill:
          profile.recommendedSkill,

        learningStatus:
          profile.learningStatus,

        averageResponseTimeMs:
          profile.averageResponseTimeMs
      };


      this.track(
        "LEARNING_RESUME_GENERATED",
        {
          resume:
            resume
        }
      );


      this.save();


      emit(
        "learning-resume-generated",
        resume
      );


      return resume;
    }


    /* ==========================================================
       EXPORT JSON
       ========================================================== */

    exportJSON() {

      const payload = {

        ...this.data,

        learningProfile:
          this.getLearningProfile(),

        exportedAt:
          nowISO()
      };


      const blob =
        new Blob(
          [
            JSON.stringify(
              payload,
              null,
              2
            )
          ],
          {
            type:
              "application/json"
          }
        );


      const url =
        URL.createObjectURL(
          blob
        );


      const a =
        document.createElement(
          "a"
        );

      a.href =
        url;

      a.download =
        `chocolate-abyss-player-${this.playerId}.json`;

      document.body.appendChild(a);

      a.click();

      a.remove();


      setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        1000
      );
    }


    /* ==========================================================
       CLEAR PLAYER DATA
       ========================================================== */

    clearPlayerData(
      options = {}
    ) {

      this.stopAutoSync();


      const newSessionId =
        id("session");


      this.sessionId =
        newSessionId;


      this.playerInfo = {

        playerId:
          this.playerId,

        name:
          "",

        age:
          null
      };


      this.learning =
        this.createEmptyLearning();


      this.data = {

        version:
          EVENT_VERSION,

        playerId:
          this.playerId,

        sessionId:
          newSessionId,

        playerInfo:
          this.playerInfo,

        learning:
          this.learning,

        events:
          [],

        sync:
          {
            lastSyncAt:
              null,

            pendingEvents:
              0,

            lastSyncStatus:
              "never"
          },

        createdAt:
          nowISO(),

        updatedAt:
          nowISO()
      };


      localStorage.setItem(
        SESSION_KEY,
        newSessionId
      );


      this.save();

      this.startAutoSync();


      if (
        options.track !== false
      ) {

        this.track(
          "PLAYER_DATA_RESET",
          {
            reason:
              options.reason ||
              "manual"
          }
        );
      }


      emit(
        "player-data-cleared",
        {
          playerId:
            this.playerId,

          sessionId:
            newSessionId
        }
      );


      return true;
    }
  }


  /* ============================================================
     CREATE GLOBAL TRACKER
     ============================================================ */

  if (
    !window.playerEventTracker
  ) {

    window.playerEventTracker =
      new PlayerEventTracker();
  }


  /* ============================================================
     GLOBAL HELPERS
     ============================================================ */

  window.PlayerEventTracker =
    PlayerEventTracker;


  window.savePlayerData =
    function () {

      return window
        .playerEventTracker
        ?.save();
    };


  window.loadPlayerData =
    function () {

      return load();
    };


  window.clearPlayerData =
    function () {

      return window
        .playerEventTracker
        ?.clearPlayerData();
    };


  window.getPlayerLearningProfile =
    function () {

      return window
        .playerEventTracker
        ?.getLearningProfile();
    };


  window.getPlayerLearningContext =
    function () {

      return window
        .playerEventTracker
        ?.getCurrentLearningContext();
    };


  window.generatePlayerLearningResume =
    function () {

      return window
        .playerEventTracker
        ?.generateLearningResume();
    };


  window.syncPlayerMemory =
    function () {

      return window
        .playerEventTracker
        ?.syncToMemory();
    };


  /* ============================================================
     GLOBAL TRACKING HELPERS
     ============================================================ */

  window.trackPlayerEvent =
    function (
      type,
      payload
    ) {

      return window
        .playerEventTracker
        ?.track(
          type,
          payload || {}
        );
    };


  window.trackQuestionShown =
    function (
      payload
    ) {

      return window
        .playerEventTracker
        ?.trackQuestionShown(
          payload || {}
        );
    };


  window.trackAnswerSubmitted =
    function (
      payload
    ) {

      return window
        .playerEventTracker
        ?.trackAnswerSubmitted(
          payload || {}
        );
    };


  window.trackHintUsed =
    function (
      payload
    ) {

      return window
        .playerEventTracker
        ?.trackHintUsed(
          payload || {}
        );
    };


  window.trackAIDecision =
    function (
      payload
    ) {

      return window
        .playerEventTracker
        ?.trackAIDecision(
          payload || {}
        );
    };


  window.trackTutorRequest =
    function (
      payload
    ) {

      return window
        .playerEventTracker
        ?.trackTutorRequest(
          payload || {}
        );
    };


  window.trackSTTRequest =
    function (
      payload
    ) {

      return window
        .playerEventTracker
        ?.trackSTTRequest(
          payload || {}
        );
    };


  /* ============================================================
     INITIAL EVENT
     ============================================================ */

  emit(
    "player-event-tracker-ready",
    {
      playerId:
        window.playerEventTracker.playerId,

      sessionId:
        window.playerEventTracker.sessionId
    }
  );


  console.log(
    "%c🍫 Chocolate Abyss Gate Player Event Tracker Ready",
    "font-weight:bold;"
  );

})();
