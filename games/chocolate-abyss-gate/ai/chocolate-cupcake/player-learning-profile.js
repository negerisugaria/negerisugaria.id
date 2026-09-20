/**
 * ============================================================
 * PLAYER LEARNING PROFILE
 * Chocolate Abyss Gate
 * Negeri Sugaria - AI Adaptive Learning
 * ============================================================
 *
 * FLOW:
 *
 * Player Event Tracker
 *        ↓
 * PlayerLearningProfile
 *        ↓
 * AI Agent / Chocolate Cupcake
 *        ↓
 * OpenClaw Memory
 *
 * RESPONSIBILITIES:
 * - Membaca event dari PlayerEventTracker
 * - Mengubah event menjadi learning profile
 * - Menghitung accuracy
 * - Menghitung mistakes
 * - Menghitung attempts
 * - Menghitung score
 * - Menghitung steps
 * - Menghitung response time
 * - Menganalisis skill matematika
 * - Menentukan recommended skill
 * - Menentukan learning status
 * - Menyediakan recent performance
 * - Menyediakan profile untuk AI Agent
 *
 * IMPORTANT:
 * File ini TIDAK mengirim langsung ke OpenClaw.
 * Pengiriman memory dilakukan oleh ai-agent.js.
 *
 * ============================================================
 */

(function () {
  "use strict";

  /* ==========================================================
     CONFIG
  ========================================================== */

  const PROFILE_VERSION = 3;

  const PROFILE_STORAGE_KEY =
    "chocolateAbyssPlayerLearningProfile";

  const PLAYER_DATA_KEY =
    "chocolateAbyssPlayerData";

  const MAX_RECENT_PERFORMANCE = 10;

  const MAX_RECENT_MISTAKES = 10;


  /* ==========================================================
     BASIC HELPERS
  ========================================================== */

  function number(value, fallback = 0) {
    const n = Number(value);

    return Number.isFinite(n)
      ? n
      : fallback;
  }


  function positiveNumber(value, fallback = 0) {
    const n = Number(value);

    return Number.isFinite(n) && n >= 0
      ? n
      : fallback;
  }


  function round(value, decimals = 2) {
    const factor = Math.pow(10, decimals);

    return Math.round(
      number(value) * factor
    ) / factor;
  }


  function clamp(value, min, max) {
    return Math.min(
      Math.max(value, min),
      max
    );
  }


  function safeString(value, fallback = "") {
    if (
      value === undefined ||
      value === null
    ) {
      return fallback;
    }

    return String(value).trim();
  }


  function safeArray(value) {
    return Array.isArray(value)
      ? value
      : [];
  }


  function nowISO() {
    return new Date().toISOString();
  }


  /* ==========================================================
     SKILL NORMALIZATION
  ========================================================== */

  function normalizeSkill(skill) {

    const value =
      safeString(skill)
        .toLowerCase()
        .trim();

    if (!value) {
      return "unknown";
    }

    if (
      value.includes("addition") ||
      value.includes("penjumlahan") ||
      value === "add" ||
      value === "+"
    ) {
      return "addition";
    }

    if (
      value.includes("subtraction") ||
      value.includes("pengurangan") ||
      value === "subtract" ||
      value === "-"
    ) {
      return "subtraction";
    }

    if (
      value.includes("multiplication") ||
      value.includes("perkalian") ||
      value === "multiply" ||
      value === "×" ||
      value === "*"
    ) {
      return "multiplication";
    }

    if (
      value.includes("division") ||
      value.includes("pembagian") ||
      value === "divide" ||
      value === "÷" ||
      value === "/"
    ) {
      return "division";
    }

    return value;
  }


  function skillFromOperator(operator) {

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
        return "unknown";
    }
  }


  /* ==========================================================
     DIFFICULTY NORMALIZATION
  ========================================================== */

  function normalizeDifficulty(value) {

    const difficulty =
      safeString(value)
        .toLowerCase();

    if (
      difficulty.includes("easy") ||
      difficulty.includes("mudah")
    ) {
      return "easy";
    }

    if (
      difficulty.includes("medium") ||
      difficulty.includes("sedang")
    ) {
      return "medium";
    }

    if (
      difficulty.includes("hard") ||
      difficulty.includes("sulit")
    ) {
      return "hard";
    }

    return difficulty || "unknown";
  }


  /* ==========================================================
     LEVEL NORMALIZATION
  ========================================================== */

  function normalizeLevel(value) {

    const level =
      safeString(value)
        .toLowerCase();

    if (
      level.includes("easy") ||
      level.includes("mudah")
    ) {
      return "easy";
    }

    if (
      level.includes("medium") ||
      level.includes("sedang")
    ) {
      return "medium";
    }

    if (
      level.includes("hard") ||
      level.includes("sulit")
    ) {
      return "hard";
    }

    return level || "unknown";
  }


  /* ==========================================================
     LEVEL ORDER
  ========================================================== */

  const LEVEL_ORDER = {
    unknown: 0,
    easy: 1,
    medium: 2,
    hard: 3
  };


  function levelRank(level) {

    return (
      LEVEL_ORDER[
        normalizeLevel(level)
      ] || 0
    );
  }


  /* ==========================================================
     EVENT TYPE NORMALIZATION
  ========================================================== */

  function normalizeEventType(type) {

    return safeString(type)
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
  }


  /* ==========================================================
     EMPTY SKILL PROFILE
  ========================================================== */

  function createSkillProfile(skill) {

    return {

      skill,

      questions: 0,

      correct: 0,

      incorrect: 0,

      mistakes: 0,

      attempts: 0,

      accuracy: 0,

      averageResponseTime: 0,

      totalResponseTime: 0,

      responseCount: 0,

      lastAnsweredAt: null,

      lastDifficulty: null

    };
  }


  /* ==========================================================
     EMPTY PROFILE
  ========================================================== */

  function createEmptyProfile(playerInfo = {}) {

    return {

      version: PROFILE_VERSION,

      generatedAt: nowISO(),

      player: {

        playerId:
          safeString(playerInfo.playerId),

        name:
          safeString(playerInfo.name),

        age:
          playerInfo.age !== null &&
          playerInfo.age !== undefined
            ? number(playerInfo.age, null)
            : null

      },

      session: {

        sessionId: null,

        startedAt: null,

        lastActivityAt: null

      },

      progress: {

        currentLevel: "unknown",

        highestLevelReached: "unknown",

        highestLevelCompleted: "unknown",

        levelsStarted: 0,

        levelsCompleted: 0,

        easyCompleted: false,

        mediumCompleted: false,

        hardCompleted: false

      },

      performance: {

        totalQuestions: 0,

        correctAnswers: 0,

        incorrectAnswers: 0,

        mistakes: 0,

        attempts: 0,

        accuracy: 0,

        averageResponseTime: 0,

        hintsUsed: 0,

        tutorRequests: 0,

        sttRequests: 0,

        aiDecisions: 0,

        score: 0,

        steps: 0

      },

      learning: {

        status: "new",

        recommendedSkill: "unknown",

        currentSkill: "unknown",

        currentDifficulty: "unknown",

        recentMistakes: 0,

        recentCorrect: 0,

        trend: "new",

        confidence: 0

      },

      skills: {

        addition:
          createSkillProfile("addition"),

        subtraction:
          createSkillProfile("subtraction"),

        multiplication:
          createSkillProfile("multiplication"),

        division:
          createSkillProfile("division")

      },

      recentPerformance: [],

      recentMistakes: [],

      lastQuestion: null,

      lastAnswer: null,

      source: {

        eventCount: 0,

        calculatedFromEvents: true

      }

    };
  }


  /* ==========================================================
     LOAD PLAYER INFO
  ========================================================== */

  function getTracker() {

    return window.playerEventTracker || null;
  }


  function getPlayerInfo() {

    const tracker =
      getTracker();

    if (
      tracker &&
      typeof tracker.getPlayerInfo === "function"
    ) {
      return tracker.getPlayerInfo();
    }

    try {

      const raw =
        localStorage.getItem(
          PLAYER_DATA_KEY
        );

      if (!raw) {
        return {
          playerId: "",
          name: "",
          age: null
        };
      }

      const data =
        JSON.parse(raw);

      return (
        data.playerInfo || {
          playerId: data.playerId || "",
          name: "",
          age: null
        }
      );

    } catch (error) {

      console.warn(
        "[PlayerLearningProfile] Cannot read player info",
        error
      );

      return {
        playerId: "",
        name: "",
        age: null
      };
    }
  }


  /* ==========================================================
     GET EVENTS
  ========================================================== */

  function getEvents() {

    const tracker =
      getTracker();

    if (
      tracker &&
      typeof tracker.getEvents === "function"
    ) {
      return safeArray(
        tracker.getEvents()
      );
    }

    try {

      const raw =
        localStorage.getItem(
          PLAYER_DATA_KEY
        );

      if (!raw) {
        return [];
      }

      const data =
        JSON.parse(raw);

      return safeArray(
        data.events
      );

    } catch (error) {

      console.warn(
        "[PlayerLearningProfile] Cannot read events",
        error
      );

      return [];
    }
  }


  /* ==========================================================
     EXTRACT RESPONSE TIME
  ========================================================== */

  function getResponseTime(event) {

    const candidates = [

      event.responseTime,

      event.response_time,

      event.responseTimeMs,

      event.response_time_ms,

      event.elapsedTime,

      event.elapsed_time,

      event.duration,

      event.durationMs

    ];

    for (
      const value of candidates
    ) {

      const n =
        Number(value);

      if (
        Number.isFinite(n) &&
        n >= 0
      ) {

        /*
         * Jika nilainya sangat besar,
         * diasumsikan milliseconds.
         */

        if (n > 1000) {
          return n / 1000;
        }

        return n;
      }
    }

    return 0;
  }


  /* ==========================================================
     EXTRACT CORRECTNESS
  ========================================================== */

  function isCorrectEvent(event) {

    if (
      event.correct === true ||
      event.isCorrect === true ||
      event.wasCorrect === true
    ) {
      return true;
    }

    if (
      event.correct === false ||
      event.isCorrect === false ||
      event.wasCorrect === false
    ) {
      return false;
    }

    const result =
      safeString(
        event.result ||
        event.answerResult ||
        event.status
      ).toLowerCase();

    if (
      result === "correct" ||
      result === "benar" ||
      result === "success"
    ) {
      return true;
    }

    if (
      result === "incorrect" ||
      result === "wrong" ||
      result === "salah"
    ) {
      return false;
    }

    return null;
  }


  /* ==========================================================
     EXTRACT SKILL
  ========================================================== */

  function getEventSkill(event) {

    const directSkill =
      event.skill ||
      event.mathSkill ||
      event.questionSkill;

    if (directSkill) {

      const normalized =
        normalizeSkill(
          directSkill
        );

      if (
        normalized !== "unknown"
      ) {
        return normalized;
      }
    }

    return skillFromOperator(
      event.op ||
      event.operator ||
      event.operation
    );
  }


  /* ==========================================================
     CREATE PROFILE
  ========================================================== */

  function calculate(
    events = [],
    playerInfo = {}
  ) {

    events =
      safeArray(events);

    const profile =
      createEmptyProfile(
        playerInfo
      );

    profile.source.eventCount =
      events.length;


    /* ========================================================
       SESSION INFORMATION
    ======================================================== */

    const sessionEvents =
      events.filter(
        event =>
          event &&
          event.sessionId
      );

    if (
      sessionEvents.length
    ) {

      const latestSession =
        sessionEvents[
          sessionEvents.length - 1
        ];

      profile.session.sessionId =
        latestSession.sessionId;
    }


    /* ========================================================
       EVENT PROCESSING
    ======================================================== */

    const answeredQuestions = [];

    const questionShownMap =
      new Map();


    events.forEach(
      event => {

        if (!event) {
          return;
        }

        const type =
          normalizeEventType(
            event.type
          );


        /* ====================================================
           LEVEL STARTED
        ==================================================== */

        if (
          type === "LEVEL_STARTED"
        ) {

          profile.progress.levelsStarted++;

          const level =
            normalizeLevel(
              event.level ||
              event.difficulty
            );

          if (
            levelRank(level) >
            levelRank(
              profile.progress.highestLevelReached
            )
          ) {

            profile.progress.highestLevelReached =
              level;
          }

          profile.progress.currentLevel =
            level;

          if (
            !profile.session.startedAt
          ) {

            profile.session.startedAt =
              event.timestamp ||
              null;
          }
        }


        /* ====================================================
           LEVEL COMPLETED
        ==================================================== */

        if (
          type === "LEVEL_COMPLETED"
        ) {

          profile.progress.levelsCompleted++;

          const level =
            normalizeLevel(
              event.level ||
              event.difficulty
            );

          if (
            levelRank(level) >
            levelRank(
              profile.progress.highestLevelCompleted
            )
          ) {

            profile.progress.highestLevelCompleted =
              level;
          }

          if (
            levelRank(level) >
            levelRank(
              profile.progress.highestLevelReached
            )
          ) {

            profile.progress.highestLevelReached =
              level;
          }

          if (level === "easy") {
            profile.progress.easyCompleted = true;
          }

          if (level === "medium") {
            profile.progress.mediumCompleted = true;
          }

          if (level === "hard") {
            profile.progress.hardCompleted = true;
          }

          profile.progress.currentLevel =
            level;

          /*
           * Game statistics may be attached
           * to LEVEL_COMPLETED.
           */

          if (
            event.score !== undefined
          ) {

            profile.performance.score =
              number(event.score);
          }

          if (
            event.steps !== undefined
          ) {

            profile.performance.steps =
              number(event.steps);
          }
        }


        /* ====================================================
           QUESTION SHOWN
        ==================================================== */

        if (
          type === "QUESTION_SHOWN"
        ) {

          const questionId =
            safeString(
              event.questionId ||
              event.id
            );

          if (questionId) {

            questionShownMap.set(
              questionId,
              event
            );
          }

          const level =
            normalizeLevel(
              event.level ||
              event.difficulty
            );

          if (
            levelRank(level) >
            levelRank(
              profile.progress.highestLevelReached
            )
          ) {

            profile.progress.highestLevelReached =
              level;
          }

          profile.progress.currentLevel =
            level;

          const skill =
            getEventSkill(event);

          if (
            profile.skills[skill]
          ) {

            profile.skills[skill].questions++;
          }
        }


        /* ====================================================
           ANSWER SUBMITTED
        ==================================================== */

        if (
          type === "ANSWER_SUBMITTED"
        ) {

          answeredQuestions.push(
            event
          );

          const correct =
            isCorrectEvent(event);

          const skill =
            getEventSkill(event);

          const difficulty =
            normalizeDifficulty(
              event.difficulty ||
              event.level
            );

          const responseTime =
            getResponseTime(event);


          /* -----------------------------------------------
             TOTAL ATTEMPTS
          ------------------------------------------------ */

          /*
           * Every ANSWER_SUBMITTED is considered
           * one answer attempt.
           */

          profile.performance.attempts++;


          /* -----------------------------------------------
             CORRECT / INCORRECT
          ------------------------------------------------ */

          if (correct === true) {

            profile.performance.correctAnswers++;

          } else if (
            correct === false
          ) {

            profile.performance.incorrectAnswers++;

            profile.performance.mistakes++;
          }


          /* -----------------------------------------------
             RESPONSE TIME
          ------------------------------------------------ */

          if (
            responseTime > 0
          ) {

            const oldCount =
              profile.performance
                .totalResponseTime;

            profile.performance
              .totalResponseTime =
              oldCount +
              responseTime;

            profile.performance
              .responseTimeCount =
              number(
                profile.performance
                  .responseTimeCount
              ) + 1;
          }


          /* -----------------------------------------------
             SKILL PROFILE
          ------------------------------------------------ */

          if (
            profile.skills[skill]
          ) {

            const skillProfile =
              profile.skills[skill];

            skillProfile.attempts++;

            if (correct === true) {

              skillProfile.correct++;

            } else if (
              correct === false
            ) {

              skillProfile.incorrect++;

              skillProfile.mistakes++;
            }

            if (
              responseTime > 0
            ) {

              skillProfile.totalResponseTime +=
                responseTime;

              skillProfile.responseCount++;
            }

            skillProfile.lastAnsweredAt =
              event.timestamp ||
              nowISO();

            skillProfile.lastDifficulty =
              difficulty;
          }


          /* -----------------------------------------------
             LAST QUESTION
          ------------------------------------------------ */

          profile.lastQuestion = {

            questionId:
              safeString(
                event.questionId
              ),

            skill,

            difficulty,

            level:
              normalizeLevel(
                event.level ||
                difficulty
              ),

            a:
              event.a !== undefined
                ? event.a
                : null,

            b:
              event.b !== undefined
                ? event.b
                : null,

            operator:
              event.op ||
              event.operator ||
              null

          };


          /* -----------------------------------------------
             LAST ANSWER
          ------------------------------------------------ */

          profile.lastAnswer = {

            correct,

            responseTime,

            attempts:
              number(
                event.attempts,
                1
              ),

            hintUsed:
              Boolean(
                event.hintUsed
              ),

            timestamp:
              event.timestamp ||
              nowISO()

          };


          /* -----------------------------------------------
             RECENT PERFORMANCE
          ------------------------------------------------ */

          profile.recentPerformance.push({

            questionId:
              safeString(
                event.questionId
              ),

            skill,

            difficulty,

            correct,

            responseTime,

            attempts:
              number(
                event.attempts,
                1
              ),

            timestamp:
              event.timestamp ||
              nowISO()

          });


          /* -----------------------------------------------
             RECENT MISTAKES
          ------------------------------------------------ */

          if (
            correct === false
          ) {

            profile.recentMistakes.push({

              questionId:
                safeString(
                  event.questionId
                ),

              skill,

              difficulty,

              responseTime,

              attempts:
                number(
                  event.attempts,
                  1
                ),

              timestamp:
                event.timestamp ||
                nowISO()

            });
          }


          /* -----------------------------------------------
             CURRENT LEVEL
          ------------------------------------------------ */

          const currentLevel =
            normalizeLevel(
              event.level ||
              difficulty
            );

          if (
            currentLevel !==
            "unknown"
          ) {

            profile.progress.currentLevel =
              currentLevel;
          }
        }


        /* ====================================================
           HINT USED
        ==================================================== */

        if (
          type === "HINT_USED"
        ) {

          profile.performance.hintsUsed++;
        }


        /* ====================================================
           TUTOR REQUEST
        ==================================================== */

        if (
          type === "TUTOR_REQUEST"
        ) {

          profile.performance.tutorRequests++;
        }


        /* ====================================================
           STT REQUEST
        ==================================================== */

        if (
          type === "STT_REQUEST"
        ) {

          profile.performance.sttRequests++;
        }


        /* ====================================================
           AI DECISION
        ==================================================== */

        if (
          type === "AI_DECISION"
        ) {

          profile.performance.aiDecisions++;
        }


        /* ====================================================
           GAME STATS UPDATED
        ==================================================== */

        if (
          type === "GAME_STATS_UPDATED"
        ) {

          if (
            event.score !== undefined
          ) {

            profile.performance.score =
              number(event.score);
          }

          if (
            event.steps !== undefined
          ) {

            profile.performance.steps =
              number(event.steps);
          }
        }


        /* ====================================================
           PLAYER STATS UPDATED
        ==================================================== */

        if (
          type === "PLAYER_STATS_UPDATED"
        ) {

          if (
            event.score !== undefined
          ) {

            profile.performance.score =
              number(event.score);
          }

          if (
            event.steps !== undefined
          ) {

            profile.performance.steps =
              number(event.steps);
          }
        }


        /* ====================================================
           GENERAL SCORE / STEP FALLBACK
        ==================================================== */

        if (
          event.score !== undefined &&
          type !== "ANSWER_SUBMITTED"
        ) {

          profile.performance.score =
            number(event.score);
        }

        if (
          event.steps !== undefined &&
          type !== "ANSWER_SUBMITTED"
        ) {

          profile.performance.steps =
            number(event.steps);
        }


        /* ====================================================
           LAST ACTIVITY
        ==================================================== */

        if (
          event.timestamp
        ) {

          profile.session.lastActivityAt =
            event.timestamp;
        }

      }
    );


    /* ========================================================
       CALCULATE TOTAL QUESTIONS
    ======================================================== */

    /*
     * QUESTION_SHOWN lebih merepresentasikan
     * jumlah soal daripada ANSWER_SUBMITTED,
     * karena satu soal dapat memiliki beberapa attempt.
     */

    const shownQuestions =
      events.filter(
        event =>
          normalizeEventType(
            event?.type
          ) === "QUESTION_SHOWN"
      );

    profile.performance.totalQuestions =
      shownQuestions.length ||
      new Set(
        answeredQuestions.map(
          event =>
            event.questionId
        ).filter(Boolean)
      ).size ||
      answeredQuestions.length;


    /* ========================================================
       FALLBACK QUESTIONS
    ======================================================== */

    if (
      profile.performance.totalQuestions === 0 &&
      answeredQuestions.length > 0
    ) {

      profile.performance.totalQuestions =
        answeredQuestions.length;
    }


    /* ========================================================
       ACCURACY
    ======================================================== */

    const totalAnswered =
      profile.performance.correctAnswers +
      profile.performance.incorrectAnswers;

    if (
      totalAnswered > 0
    ) {

      profile.performance.accuracy =
        round(
          profile.performance.correctAnswers /
          totalAnswered,
          4
        );
    } else {

      profile.performance.accuracy = 0;
    }


    /* ========================================================
       AVERAGE RESPONSE TIME
    ======================================================== */

    const totalResponseTime =
      number(
        profile.performance
          .totalResponseTime
      );

    const responseCount =
      number(
        profile.performance
          .responseTimeCount
      );

    profile.performance.averageResponseTime =
      responseCount > 0
        ? round(
            totalResponseTime /
            responseCount,
            2
          )
        : 0;


    /*
     * Internal helper property.
     * Keep it available for AI calculations,
     * but it can be ignored by UI.
     */
    delete profile.performance.responseTimeCount;
    delete profile.performance.totalResponseTime;


    /* ========================================================
       SKILL ACCURACY
    ======================================================== */

    Object.keys(
      profile.skills
    ).forEach(
      skill => {

        const data =
          profile.skills[skill];

        if (
          data.attempts > 0
        ) {

          data.accuracy =
            round(
              data.correct /
              data.attempts,
              4
            );
        } else {

          data.accuracy = 0;
        }


        if (
          data.responseCount > 0
        ) {

          data.averageResponseTime =
            round(
              data.totalResponseTime /
              data.responseCount,
              2
            );

        } else {

          data.averageResponseTime = 0;
        }


        /*
         * Internal calculation properties
         */
        delete data.totalResponseTime;
        delete data.responseCount;
      }
    );


    /* ========================================================
       RECENT PERFORMANCE LIMIT
    ======================================================== */

    profile.recentPerformance =
      profile.recentPerformance
        .slice(
          -MAX_RECENT_PERFORMANCE
        );


    profile.recentMistakes =
      profile.recentMistakes
        .slice(
          -MAX_RECENT_MISTAKES
        );


    /* ========================================================
       RECENT MISTAKE COUNT
    ======================================================== */

    const recentMistakes =
      profile.recentPerformance
        .filter(
          item =>
            item.correct === false
        );

    const recentCorrect =
      profile.recentPerformance
        .filter(
          item =>
            item.correct === true
        );

    profile.learning.recentMistakes =
      recentMistakes.length;

    profile.learning.recentCorrect =
      recentCorrect.length;


    /* ========================================================
       LEARNING STATUS
    ======================================================== */

    const accuracy =
      profile.performance.accuracy;

    const questionCount =
      profile.performance.totalQuestions;


    if (
      questionCount === 0
    ) {

      profile.learning.status =
        "new";

    } else if (
      accuracy < 0.5
    ) {

      profile.learning.status =
        "needs_support";

    } else if (
      accuracy < 0.7
    ) {

      profile.learning.status =
        "developing";

    } else if (
      accuracy < 0.85
    ) {

      profile.learning.status =
        "progressing";

    } else {

      profile.learning.status =
        "strong";
    }


    /* ========================================================
       PERFORMANCE TREND
    ======================================================== */

    if (
      recentCorrect.length >
      recentMistakes.length
    ) {

      profile.learning.trend =
        "improving";

    } else if (
      recentMistakes.length >
      recentCorrect.length
    ) {

      profile.learning.trend =
        "needs_support";

    } else if (
      recentCorrect.length > 0 ||
      recentMistakes.length > 0
    ) {

      profile.learning.trend =
        "stable";

    } else {

      profile.learning.trend =
        "new";
    }


    /* ========================================================
       RECOMMENDED SKILL
    ======================================================== */

    profile.learning.recommendedSkill =
      determineRecommendedSkill(
        profile.skills
      );


    /* ========================================================
       CURRENT SKILL
    ======================================================== */

    if (
      profile.lastQuestion &&
      profile.lastQuestion.skill
    ) {

      profile.learning.currentSkill =
        profile.lastQuestion.skill;
    } else {

      profile.learning.currentSkill =
        profile.learning.recommendedSkill;
    }


    /* ========================================================
       CURRENT DIFFICULTY
    ======================================================== */

    if (
      profile.lastQuestion &&
      profile.lastQuestion.difficulty
    ) {

      profile.learning.currentDifficulty =
        profile.lastQuestion.difficulty;
    }


    /* ========================================================
       LEARNING CONFIDENCE
    ======================================================== */

    profile.learning.confidence =
      calculateConfidence(
        profile
      );


    /* ========================================================
       HIGHEST LEVEL FALLBACK
    ======================================================== */

    if (
      profile.progress.highestLevelReached ===
      "unknown"
    ) {

      profile.progress.highestLevelReached =
        profile.progress.currentLevel;
    }


    /* ========================================================
       FINAL TIMESTAMP
    ======================================================== */

    profile.generatedAt =
      nowISO();


    return profile;
  }


  /* ==========================================================
     DETERMINE RECOMMENDED SKILL
  ========================================================== */

  function determineRecommendedSkill(
    skills
  ) {

    const available =
      Object.values(
        skills
      ).filter(
        skill =>
          skill.attempts > 0
      );


    /*
     * Belum ada data:
     * gunakan addition sebagai default
     * karena paling dasar.
     */

    if (
      available.length === 0
    ) {

      return "addition";
    }


    /*
     * Prioritas:
     *
     * 1. Accuracy terendah
     * 2. Jika sama, attempts terbanyak
     *
     * Tujuannya adalah mencari skill
     * yang paling membutuhkan latihan.
     */

    available.sort(
      (a, b) => {

        if (
          a.accuracy !==
          b.accuracy
        ) {

          return (
            a.accuracy -
            b.accuracy
          );
        }

        return (
          b.attempts -
          a.attempts
        );
      }
    );


    return available[0].skill;
  }


  /* ==========================================================
     CALCULATE CONFIDENCE
  ========================================================== */

  function calculateConfidence(
    profile
  ) {

    const accuracy =
      clamp(
        profile.performance.accuracy,
        0,
        1
      );

    const questions =
      profile.performance.totalQuestions;

    /*
     * Confidence meningkat jika:
     * - accuracy tinggi
     * - jumlah soal cukup
     */

    const dataConfidence =
      clamp(
        questions / 20,
        0,
        1
      );

    const confidence =
      (
        accuracy * 0.7
      ) +
      (
        dataConfidence * 0.3
      );

    return round(
      confidence,
      2
    );
  }


  /* ==========================================================
     GET CURRENT PROFILE
  ========================================================== */

  function calculateCurrentProfile() {

    const playerInfo =
      getPlayerInfo();

    const events =
      getEvents();

    return calculate(
      events,
      playerInfo
    );
  }


  /* ==========================================================
     CACHE PROFILE
  ========================================================== */

  function saveProfile(
    profile
  ) {

    try {

      localStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify(
          profile
        )
      );

    } catch (error) {

      console.warn(
        "[PlayerLearningProfile] Cannot save profile",
        error
      );
    }

    return profile;
  }


  /* ==========================================================
     LOAD CACHED PROFILE
  ========================================================== */

  function loadProfile() {

    try {

      const raw =
        localStorage.getItem(
          PROFILE_STORAGE_KEY
        );

      if (!raw) {
        return null;
      }

      return JSON.parse(raw);

    } catch (error) {

      console.warn(
        "[PlayerLearningProfile] Cannot load cached profile",
        error
      );

      return null;
    }
  }


  /* ==========================================================
     REFRESH PROFILE
  ========================================================== */

  function refreshProfile(
    options = {}
  ) {

    const profile =
      calculateCurrentProfile();

    saveProfile(
      profile
    );

    window.currentPlayerLearningProfile =
      profile;


    /*
     * Notify AI Agent and UI.
     */

    try {

      window.dispatchEvent(
        new CustomEvent(
          "player-learning-profile-updated",
          {
            detail: profile
          }
        )
      );

    } catch (error) {

      console.warn(
        "[PlayerLearningProfile] Event dispatch failed",
        error
      );
    }


    /*
     * Optional:
     * notify AI Agent directly.
     */

    if (
      options.notifyAI !== false &&
      typeof window.onPlayerLearningProfileUpdated ===
      "function"
    ) {

      try {

        window.onPlayerLearningProfileUpdated(
          profile
        );

      } catch (error) {

        console.warn(
          "[PlayerLearningProfile] AI callback failed",
          error
        );
      }
    }


    return profile;
  }


  /* ==========================================================
     PROFILE SNAPSHOT FOR AI AGENT
  ========================================================== */

  function getAISnapshot(
    profile = null
  ) {

    profile =
      profile ||
      window.currentPlayerLearningProfile ||
      calculateCurrentProfile();


    return {

      version:
        profile.version,

      player: {
        playerId:
          profile.player.playerId,

        name:
          profile.player.name,

        age:
          profile.player.age
      },

      progress: {

        currentLevel:
          profile.progress.currentLevel,

        highestLevelReached:
          profile.progress.highestLevelReached,

        highestLevelCompleted:
          profile.progress.highestLevelCompleted,

        levelsCompleted:
          profile.progress.levelsCompleted
      },

      performance: {

        totalQuestions:
          profile.performance.totalQuestions,

        correctAnswers:
          profile.performance.correctAnswers,

        incorrectAnswers:
          profile.performance.incorrectAnswers,

        mistakes:
          profile.performance.mistakes,

        attempts:
          profile.performance.attempts,

        accuracy:
          profile.performance.accuracy,

        averageResponseTime:
          profile.performance.averageResponseTime,

        hintsUsed:
          profile.performance.hintsUsed,

        tutorRequests:
          profile.performance.tutorRequests,

        sttRequests:
          profile.performance.sttRequests,

        score:
          profile.performance.score,

        steps:
          profile.performance.steps
      },

      learning: {

        status:
          profile.learning.status,

        trend:
          profile.learning.trend,

        confidence:
          profile.learning.confidence,

        recommendedSkill:
          profile.learning.recommendedSkill,

        currentSkill:
          profile.learning.currentSkill,

        currentDifficulty:
          profile.learning.currentDifficulty,

        recentMistakes:
          profile.learning.recentMistakes,

        recentCorrect:
          profile.learning.recentCorrect
      },

      skills:
        JSON.parse(
          JSON.stringify(
            profile.skills
          )
        ),

      recentPerformance:
        profile.recentPerformance.slice(
          -5
        ),

      recentMistakes:
        profile.recentMistakes.slice(
          -5
        ),

      lastQuestion:
        profile.lastQuestion,

      lastAnswer:
        profile.lastAnswer
    };
  }


  /* ==========================================================
     GET RECOMMENDED SKILL
  ========================================================== */

  function getRecommendedSkill() {

    const profile =
      window.currentPlayerLearningProfile ||
      calculateCurrentProfile();

    return (
      profile.learning
        .recommendedSkill
    );
  }


  /* ==========================================================
     GET LEARNING STATUS
  ========================================================== */

  function getLearningStatus() {

    const profile =
      window.currentPlayerLearningProfile ||
      calculateCurrentProfile();

    return (
      profile.learning
        .status
    );
  }


  /* ==========================================================
     GET TRACKER PROFILE
  ========================================================== */

  function getTrackerProfile() {

    const info =
      getPlayerInfo();

    const events =
      getEvents();

    return {

      playerInfo: info,

      eventCount:
        events.length,

      events
    };
  }


  /* ==========================================================
     AUTO REFRESH AFTER PLAYER EVENT
  ========================================================== */

  window.addEventListener(
    "player-event",
    function (event) {

      /*
       * Recalculate asynchronously
       * so PlayerEventTracker can
       * finish saving first.
       */

      setTimeout(
        function () {

          try {

            refreshProfile({
              notifyAI: true
            });

          } catch (error) {

            console.error(
              "[PlayerLearningProfile] Refresh error",
              error
            );
          }

        },
        0
      );
    }
  );


  /* ==========================================================
     INITIAL PROFILE
  ========================================================== */

  try {

    const initialProfile =
      calculateCurrentProfile();

    window.currentPlayerLearningProfile =
      initialProfile;

    saveProfile(
      initialProfile
    );

  } catch (error) {

    console.error(
      "[PlayerLearningProfile] Initial calculation failed",
      error
    );
  }


  /* ==========================================================
     PUBLIC API
  ========================================================== */

  window.PlayerLearningProfile = {

    version:
      PROFILE_VERSION,

    calculate,

    calculateCurrentProfile,

    refresh:
      refreshProfile,

    getEvents,

    getPlayerInfo,

    getTrackerProfile,

    getRecommendedSkill,

    getLearningStatus,

    getAISnapshot,

    normalizeSkill,

    normalizeDifficulty,

    normalizeLevel,

    load:
      loadProfile,

    save:
      saveProfile

  };


  /* ==========================================================
     GLOBAL SHORTCUTS
  ========================================================== */

  window.getLearningProfileSnapshot =
    function () {

      return getAISnapshot();

    };


  window.refreshPlayerLearningProfile =
    function () {

      return refreshProfile();

    };


  window.getRecommendedLearningSkill =
    function () {

      return getRecommendedSkill();

    };


  window.getPlayerLearningStatus =
    function () {

      return getLearningStatus();

    };


  /* ==========================================================
     DEBUG HELPER
  ========================================================== */

  window.debugPlayerLearningProfile =
    function () {

      const profile =
        calculateCurrentProfile();

      console.group(
        "🍫 Player Learning Profile"
      );

      console.log(
        "Player:",
        profile.player
      );

      console.log(
        "Progress:",
        profile.progress
      );

      console.log(
        "Performance:",
        profile.performance
      );

      console.log(
        "Learning:",
        profile.learning
      );

      console.log(
        "Skills:",
        profile.skills
      );

      console.log(
        "Recent Performance:",
        profile.recentPerformance
      );

      console.log(
        "Recent Mistakes:",
        profile.recentMistakes
      );

      console.groupEnd();

      return profile;
    };


  /* ==========================================================
     READY EVENT
  ========================================================== */

  window.dispatchEvent(
    new CustomEvent(
      "player-learning-profile-ready",
      {
        detail: {
          version:
            PROFILE_VERSION
        }
      }
    )
  );


  console.log(
    `[PlayerLearningProfile] v${PROFILE_VERSION} ready`
  );

})();
