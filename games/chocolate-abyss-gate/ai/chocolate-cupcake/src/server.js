"use strict";

/**
 * ============================================================
 * CHOCOLATE CUPCAKE AI AGENT SERVER
 * Negeri Sugaria - Chocolate Abyss Gate
 * ============================================================
 *
 * ARCHITECTURE
 *
 * Browser Game
 *     │
 *     ├── player-event-tracker.js
 *     │
 *     ├── player-learning-profile.js
 *     │
 *     └── ai-agent.js
 *              │
 *              ▼
 *       POST /api/cupcake/respond
 *              │
 *              ▼
 *       Chocolate Cupcake API
 *              │
 *              ▼
 *           OpenClaw
 *              │
 *              ├── AI Decision
 *              ├── Conversation
 *              └── Memory
 *              │
 *              ▼
 *       Chocolate Cupcake Response
 *
 * ============================================================
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");


/* =========================================================
   CONFIGURATION
========================================================= */

const HOST =
  process.env.HOST || "127.0.0.1";

const PORT =
  Number(process.env.PORT || 3000);

const AGENT =
  process.env.OPENCLAW_AGENT || "main";

/*
 * IMPORTANT:
 * Prefer setting the model in OpenClaw configuration.
 *
 * If OPENCLAW_MODEL is provided, this server will explicitly
 * send --model to OpenClaw.
 */
const MODEL =
  process.env.OPENCLAW_MODEL ||
  "9router/openrouter/nvidia/nemotron-3-super-120b-a12b:free";

/*
 * OpenClaw timeout in milliseconds.
 */
const TIMEOUT =
  Number(
    process.env.OPENCLAW_TIMEOUT || 55000
  );

/*
 * Retry count.
 */
const RETRIES =
  Number(
    process.env.OPENCLAW_RETRIES || 1
  );

const RETRY_DELAY =
  Number(
    process.env.OPENCLAW_RETRY_DELAY || 1500
  );


/*
 * Maximum request body.
 *
 * PlayerLearningProfile + recent events can become
 * relatively large.
 */
const MAX_BODY_SIZE =
  Number(
    process.env.MAX_BODY_SIZE ||
    2 * 1024 * 1024
  );

/*
 * Local persistent memory store used by /api/memory.
 * The browser keeps localStorage as its fallback; this file
 * makes the configured Memory API real and prevents HTTP 404.
 */
const MEMORY_DIR =
  process.env.MEMORY_DIR ||
  path.join(__dirname, "..", "data");

const MEMORY_FILE =
  process.env.MEMORY_FILE ||
  path.join(MEMORY_DIR, "player-memory.jsonl");


/* =========================================================
   CORS
========================================================= */

const ALLOWED_ORIGINS = new Set([

  "https://negerisugaria.id",

  "https://www.negerisugaria.id",

  "http://localhost",

  "http://localhost:3000",

  "http://localhost:5500",

  "http://127.0.0.1",

  "http://127.0.0.1:3000",

  "http://127.0.0.1:5500"

]);


function getCorsOrigin(req) {

  const origin =
    req.headers.origin;

  if (!origin) {
    return null;
  }

  if (
    ALLOWED_ORIGINS.has(origin)
  ) {

    return origin;
  }

  return null;
}


function applyCors(req, res) {

  const origin =
    getCorsOrigin(req);

  if (origin) {

    res.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );

    res.setHeader(
      "Vary",
      "Origin"
    );
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    [
      "Content-Type",
      "Authorization",
      "X-Requested-With"
    ].join(", ")
  );

  res.setHeader(
    "Access-Control-Max-Age",
    "86400"
  );

  res.setHeader(
    "Access-Control-Expose-Headers",
    "Content-Type"
  );
}


/* =========================================================
   PROMPTS
========================================================= */

const ROOT_DIR =
  path.resolve(
    __dirname,
    ".."
  );

const PROMPT_DIR =
  path.join(
    ROOT_DIR,
    "prompts"
  );


function readPrompt(filename) {

  const file =
    path.join(
      PROMPT_DIR,
      filename
    );

  try {

    return fs
      .readFileSync(
        file,
        "utf8"
      )
      .trim();

  } catch (error) {

    console.error(
      `[Chocolate Cupcake] Failed to read prompt ${filename}:`,
      error.message
    );

    return "";
  }
}


const SYSTEM_PROMPT =
  readPrompt("SYSTEM.md");

const PERSONA_PROMPT =
  readPrompt("PERSONA.md");

const STATES_PROMPT =
  readPrompt("STATES.md");

const BEHAVIOR_PROMPT =
  readPrompt("BEHAVIOR.md");

const RESPONSE_FORMAT_PROMPT =
  readPrompt(
    "RESPONSE-FORMAT.md"
  );


/* =========================================================
   JSON HELPERS
========================================================= */

function sendJson(
  res,
  statusCode,
  data
) {

  if (
    !res.headersSent
  ) {

    res.statusCode =
      statusCode;

    res.setHeader(
      "Content-Type",
      "application/json; charset=utf-8"
    );
  }

  res.end(
    JSON.stringify(data)
  );
}


function safeJsonParse(value) {

  if (
    !value ||
    typeof value !== "string"
  ) {

    return null;
  }


  /*
   * Direct JSON.
   */

  try {

    return JSON.parse(
      value
    );

  } catch (_) {}


  /*
   * OpenClaw / model may occasionally
   * wrap JSON in additional text.
   */

  const firstBrace =
    value.indexOf("{");

  const lastBrace =
    value.lastIndexOf("}");


  if (
    firstBrace !== -1 &&
    lastBrace > firstBrace
  ) {

    const possibleJson =
      value.slice(
        firstBrace,
        lastBrace + 1
      );

    try {

      return JSON.parse(
        possibleJson
      );

    } catch (_) {}
  }


  return null;
}


/* =========================================================
   OPENCLAW JSON EXTRACTION
========================================================= */

function extractOpenClawText(
  rawOutput
) {

  if (
    !rawOutput ||
    typeof rawOutput !== "string"
  ) {

    return "";
  }


  /*
   * First attempt:
   * OpenClaw --json envelope.
   */

  const envelope =
    safeJsonParse(
      rawOutput
    );


  if (
    envelope &&
    typeof envelope === "object"
  ) {

    /*
     * Current OpenClaw agent --json
     * exposes final assistant text.
     */

    if (
      typeof envelope.final ===
      "string"
    ) {

      return envelope.final.trim();
    }


    /*
     * Some versions / output modes
     * may expose payloads.
     */

    if (
      Array.isArray(
        envelope.payloads
      )
    ) {

      const texts =
        envelope.payloads
          .map(
            item =>
              typeof item?.text ===
              "string"
                ? item.text
                : ""
          )
          .filter(Boolean);

      if (
        texts.length
      ) {

        return texts.join("\n").trim();
      }
    }
  }


  /*
   * Fallback:
   * treat stdout as plain assistant text.
   */

  return rawOutput.trim();
}


/* =========================================================
   CUPCAKE RESPONSE
========================================================= */

const VALID_STATES =
  new Set([

    "welcome",

    "thinking",

    "encouraging",

    "oops",

    "teaching",

    "celebrating",

    "victory"

  ]);


const VALID_EMOTIONS =
  new Set([

    "happy",

    "excited",

    "thinking",

    "encouraging",

    "oops",

    "teaching",

    "celebrating",

    "victory",

    "calm"

  ]);


function normalizeResponse(
  data,
  fallback
) {

  const source =
    data &&
    typeof data === "object"
      ? data
      : {};


  const state =
    VALID_STATES.has(
      source.state
    )
      ? source.state
      : fallback.state;


  const message =
    typeof source.message ===
      "string" &&
    source.message.trim()
      ? source.message.trim()
      : fallback.message;


  const hint =
    typeof source.hint ===
      "string"
      ? source.hint.trim()
      : fallback.hint || "";


  const visual =
    source.visual &&
    typeof source.visual ===
      "object"

      ? {

          enabled:
            source.visual.enabled ===
            true,

          content:
            typeof source.visual.content ===
            "string"
              ? source.visual.content
              : ""

        }

      : {

          enabled:
            fallback.visual?.enabled ===
            true,

          content:
            fallback.visual?.content ||
            ""

        };


  const emotion =
    typeof source.emotion ===
      "string" &&
    VALID_EMOTIONS.has(
      source.emotion
    )

      ? source.emotion

      : fallback.emotion ||
        "calm";


  return {

    success: true,

    state,

    message,

    hint,

    visual,

    speak:
      source.speak !== false,

    emotion

  };
}


/* =========================================================
   LOCAL FALLBACK
========================================================= */

function createFallback(
  eventData = {}
) {

  const event =
    eventData.event;


  /* -------------------------------------------------------
     GAME START
  ------------------------------------------------------- */

  if (
    event ===
    "game_started"
  ) {

    return {

      success: true,

      state: "welcome",

      message:
        "Halo! Aku Chocolate Cupcake. Yuk kita mulai petualangan!",

      hint: "",

      visual: {

        enabled: false,

        content: ""

      },

      speak: true,

      emotion: "happy"

    };
  }


  /* -------------------------------------------------------
     LEVEL / GAME COMPLETED
  ------------------------------------------------------- */

  if (

    event ===
      "level_completed" ||

    event ===
      "game_completed"

  ) {

    return {

      success: true,

      state: "victory",

      message:
        "Selamat! Kamu berhasil menyelesaikan tantangan ini!",

      hint: "",

      visual: {

        enabled: false,

        content: ""

      },

      speak: true,

      emotion: "victory"

    };
  }


  /* -------------------------------------------------------
     ANSWER SUBMITTED
  ------------------------------------------------------- */

  if (
    event ===
    "answer_submitted"
  ) {

    const correct =
      eventData.correct ===
      true;

    const attempt =
      Number(
        eventData.attempt ||
        eventData.attempts ||
        1
      );


    /* Correct */

    if (
      correct
    ) {

      return {

        success: true,

        state:
          "celebrating",

        message:
          "Benar! Hebat sekali!",

        hint: "",

        visual: {

          enabled: false,

          content: ""

        },

        speak: true,

        emotion:
          "celebrating"

      };
    }


    /* First mistake */

    if (
      attempt <= 1
    ) {

      return {

        success: true,

        state:
          "encouraging",

        message:
          "Tidak apa-apa. Coba lagi pelan-pelan ya!",

        hint:
          typeof eventData.hint ===
          "string"

            ? eventData.hint

            : "Perhatikan angka dan tanda operasinya.",

        visual: {

          enabled: false,

          content: ""

        },

        speak: true,

        emotion:
          "encouraging"

      };
    }


    /* Second mistake */

    if (
      attempt === 2
    ) {

      return {

        success: true,

        state:
          "teaching",

        message:
          "Kita lakukan pelan-pelan. Hitung satu per satu ya.",

        hint:
          typeof eventData.hint ===
          "string"

            ? eventData.hint

            : "",

        visual: {

          enabled: false,

          content: ""

        },

        speak: true,

        emotion:
          "teaching"

      };
    }


    /* Multiple mistakes */

    return {

      success: true,

      state:
        "teaching",

      message:
        "Ayo kita gunakan gambar supaya lebih mudah.",

      hint:
        typeof eventData.hint ===
        "string"

          ? eventData.hint

          : "",

      visual: {

        enabled: true,

        content:
          typeof eventData.visualMath ===
          "string"

            ? eventData.visualMath

            : ""

      },

      speak: true,

      emotion:
        "teaching"

    };
  }


  /* -------------------------------------------------------
     DEFAULT
  ------------------------------------------------------- */

  return {

    success: true,

    state:
      "encouraging",

    message:
      "Ayo kita coba bersama!",

    hint: "",

    visual: {

      enabled: false,

      content: ""

    },

    speak: true,

    emotion:
      "encouraging"

  };
}


/* =========================================================
   MEMORY CONTEXT
========================================================= */

function buildMemoryContext(
  eventData
) {

  /*
   * OpenClaw Memory can be supplied by the
   * AI Agent layer.
   *
   * We intentionally do not fabricate memory.
   */

  if (
    eventData.memoryContext
  ) {

    return eventData.memoryContext;
  }


  if (
    eventData.memory
  ) {

    return eventData.memory;
  }


  return null;
}


/* =========================================================
   PLAYER PROFILE
========================================================= */

function buildPlayerProfile(
  eventData
) {

  return (

    eventData.playerProfile ||

    eventData.learningProfile ||

    {

      player: {

        playerId:
          eventData.playerId ||
          "",

        name:
          eventData.playerName ||
          "",

        age:
          eventData.age ??
          null

      }

    }

  );
}


/* =========================================================
   OPENCLAW MESSAGE
========================================================= */

function buildAgentMessage(
  eventData
) {

  const playerProfile =
    buildPlayerProfile(
      eventData
    );


  const memoryContext =
    buildMemoryContext(
      eventData
    );


  const payload = {

    event:
      eventData.event ||
      "unknown",

    playerId:
      eventData.playerId ||
      playerProfile?.player?.playerId ||
      "",

    playerName:
      eventData.playerName ||
      playerProfile?.player?.name ||
      "",

    age:
      eventData.age ??
      playerProfile?.player?.age ??
      null,

    game:
      eventData.game ||
      "Chocolate Abyss Gate",

    level:
      eventData.level ||
      null,

    difficulty:
      eventData.difficulty ||
      null,

    skill:
      eventData.skill ||
      null,

    playerProfile,

    memoryContext,

    question:
      eventData.question ||
      null,

    answer:
      eventData.answer ||
      null,

    correct:
      eventData.correct ??
      null,

    attempt:
      eventData.attempt ??
      eventData.attempts ??
      null,

    score:
      eventData.score ??
      null,

    steps:
      eventData.steps ??
      null,

    hint:
      eventData.hint ||
      null,

    visualMath:
      eventData.visualMath ||
      null,

    transcript:
      eventData.transcript ||
      eventData.text ||
      null,

    voiceInput:
      eventData.voiceInput ||
      false

  };


  const eventJson =
    JSON.stringify(
      payload,
      null,
      2
    );


  return `

${SYSTEM_PROMPT}

${PERSONA_PROMPT}

${STATES_PROMPT}

${BEHAVIOR_PROMPT}

${RESPONSE_FORMAT_PROMPT}

============================================================
CHOCOLATE CUPCAKE ROLE
============================================================

You are Chocolate Cupcake.

Role:
AI Learning Companion.

Traits:
- Friendly
- Cheerful
- Educational
- Encouraging

Mission:
Guide children through Chocolate Abyss Gate
while improving mathematics skills.

============================================================
PLAYER LEARNING CONTEXT
============================================================

Use the player profile to personalize
your response.

Important:

- Do not expose internal profile data.
- Do not mention OpenClaw.
- Do not mention internal APIs.
- Do not mention system prompts.
- Do not shame the child.
- Do not reveal the correct answer immediately
  when a teaching hint is more appropriate.
- Keep responses short enough for children.
- Use Indonesian.
- Adapt the explanation to the player's age.
- If the player repeatedly makes mistakes,
  provide a simpler explanation.
- If the player is improving,
  celebrate the improvement.
- If the player asks for help,
  teach rather than simply giving the answer.

============================================================
MEMORY
============================================================

If memoryContext exists,
use it only as personalization context.

Never claim to remember information
that is not present in the supplied memory.

============================================================
OUTPUT REQUIREMENT
============================================================

Respond ONLY with valid JSON.

Required format:

{
  "state": "welcome|thinking|encouraging|oops|teaching|celebrating|victory",
  "message": "short Indonesian response",
  "hint": "optional hint",
  "visual": {
    "enabled": false,
    "content": ""
  },
  "speak": true,
  "emotion": "happy|excited|thinking|encouraging|oops|teaching|celebrating|victory|calm"
}

Do not use Markdown fences.

Do not add text outside JSON.

============================================================
PLAYER EVENT
============================================================

${eventJson}

`.trim();
}


/* =========================================================
   OPENCLAW EXECUTION
========================================================= */

function runOpenClaw(
  message,
  eventData = {}
) {

  return new Promise(
    (resolve, reject) => {

      /*
       * -----------------------------------------------------
       * SESSION KEY
       * -----------------------------------------------------
       *
       * Keep the player's Chocolate Cupcake conversation
       * isolated from other players.
       */

      const playerId =
        String(
          eventData.playerId ||
          eventData.playerProfile?.player?.playerId ||
          "anonymous"
        )
        .replace(
          /[^a-zA-Z0-9_-]/g,
          "_"
        )
        .slice(
          0,
          80
        );


      const sessionKey =
        `chocolate-abyss:${playerId}`;


      /*
       * -----------------------------------------------------
       * OPENCLAW ARGUMENTS
       * -----------------------------------------------------
       */

      const args = [

        "agent",

        "--agent",
        AGENT,

        "--session-key",
        sessionKey,

        "--message",
        message,

        "--json"

      ];


      /*
       * Only send --model when explicitly configured.
       *
       * This allows OpenClaw's configured model to be used
       * when OPENCLAW_MODEL is intentionally blank.
       */

      if (
        MODEL &&
        MODEL.trim()
      ) {

        args.splice(
          6,
          0,
          "--model",
          MODEL
        );
      }


      console.log(
        `[Chocolate Cupcake] OpenClaw request: agent=${AGENT}, session=${sessionKey}, model=${MODEL || "configured-default"}`
      );


      const child =
        spawn(
          "openclaw",
          args,
          {

            stdio: [
              "ignore",
              "pipe",
              "pipe"
            ],

            env:
              process.env

          }
        );


      let stdout = "";

      let stderr = "";

      let finished =
        false;


      const timer =
        setTimeout(
          () => {

            if (
              finished
            ) {
              return;
            }


            finished =
              true;


            try {

              child.kill(
                "SIGTERM"
              );

            } catch (_) {}


            console.error(
              `[Chocolate Cupcake] OpenClaw timeout after ${TIMEOUT}ms`
            );


            reject(
              new Error(
                `OpenClaw timeout after ${TIMEOUT}ms`
              )
            );

          },
          TIMEOUT
        );


      child.stdout.on(
        "data",
        chunk => {

          stdout +=
            chunk.toString();

        }
      );


      child.stderr.on(
        "data",
        chunk => {

          stderr +=
            chunk.toString();

        }
      );


      child.on(
        "error",
        error => {

          if (
            finished
          ) {
            return;
          }


          finished =
            true;


          clearTimeout(
            timer
          );


          reject(
            error
          );

        }
      );


      child.on(
        "close",
        code => {

          if (
            finished
          ) {
            return;
          }


          finished =
            true;


          clearTimeout(
            timer
          );


          if (
            code !== 0
          ) {

            console.error(
              "[Chocolate Cupcake] OpenClaw exited with code:",
              code
            );


            if (
              stderr.trim()
            ) {

              console.error(
                "[Chocolate Cupcake] OpenClaw stderr:",
                stderr
                  .trim()
                  .slice(
                    0,
                    3000
                  )
              );
            }


            reject(
              new Error(
                `OpenClaw exited with code ${code}`
              )
            );

            return;
          }


          resolve(
            stdout.trim()
          );

        }
      );

    }
  );
}


/* =========================================================
   RETRY
========================================================= */

function sleep(ms) {

  return new Promise(
    resolve => {

      setTimeout(
        resolve,
        ms
      );

    }
  );
}


async function runOpenClawWithRetry(
  message,
  eventData
) {

  let lastError =
    null;


  for (
    let attempt = 0;
    attempt <= RETRIES;
    attempt++
  ) {

    try {

      return await runOpenClaw(
        message,
        eventData
      );

    } catch (error) {

      lastError =
        error;


      console.error(
        `[Chocolate Cupcake] OpenClaw attempt ${
          attempt + 1
        } failed: ${error.message}`
      );


      if (
        attempt < RETRIES
      ) {

        await sleep(
          RETRY_DELAY
        );
      }
    }
  }


  throw (
    lastError ||
    new Error(
      "OpenClaw failed"
    )
  );
}


/* =========================================================
   MEMORY API
========================================================= */

function normalizeMemoryPayload(payload = {}) {

  return {
    type:
      typeof payload.type === "string"
        ? payload.type.slice(0, 80)
        : "player_learning_profile",

    playerId:
      typeof payload.playerId === "string"
        ? payload.playerId.slice(0, 120)
        : null,

    sessionId:
      typeof payload.sessionId === "string"
        ? payload.sessionId.slice(0, 120)
        : null,

    player:
      payload.player && typeof payload.player === "object"
        ? payload.player
        : {},

    profile:
      payload.profile && typeof payload.profile === "object"
        ? payload.profile
        : {},

    recentEvents:
      Array.isArray(payload.recentEvents)
        ? payload.recentEvents.slice(-20)
        : [],

    timestamp:
      typeof payload.timestamp === "string"
        ? payload.timestamp
        : new Date().toISOString()
  };
}


function saveMemoryPayload(payload) {

  fs.mkdirSync(MEMORY_DIR, { recursive: true });

  fs.appendFileSync(
    MEMORY_FILE,
    JSON.stringify(payload) + "\n",
    "utf8"
  );
}


/* =========================================================
   API HANDLER
========================================================= */

async function handleCupcake(
  eventData
) {

  const fallback =
    createFallback(
      eventData
    );


  try {

    const message =
      buildAgentMessage(
        eventData
      );


    const rawOutput =
      await runOpenClawWithRetry(
        message,
        eventData
      );


    /*
     * IMPORTANT:
     *
     * --json from OpenClaw is an envelope.
     * Extract final assistant text first.
     */

    const assistantText =
      extractOpenClawText(
        rawOutput
      );


    if (
      !assistantText
    ) {

      console.error(
        "[Chocolate Cupcake] Empty response from OpenClaw"
      );


      return {

        ...fallback,

        fallback: true,

        reason:
          "empty_ai_response"

      };
    }


    /*
     * The assistant's final text should itself
     * contain our Chocolate Cupcake JSON.
     */

    const parsed =
      safeJsonParse(
        assistantText
      );


    if (
      !parsed
    ) {

      console.error(
        "[Chocolate Cupcake] Invalid Cupcake JSON"
      );


      console.error(
        "[Chocolate Cupcake] Assistant text:",
        assistantText.slice(
          0,
          3000
        )
      );


      /*
       * Graceful degradation:
       *
       * Instead of exposing raw AI output,
       * return the safe local fallback.
       */

      return {

        ...fallback,

        fallback: true,

        reason:
          "invalid_ai_response"

      };
    }


    return normalizeResponse(
      parsed,
      fallback
    );

  } catch (error) {

    console.error(
      "[Chocolate Cupcake] AI unavailable:",
      error.message
    );


    return {

      ...fallback,

      fallback: true,

      reason:
        "ai_unavailable"

    };
  }
}


/* =========================================================
   REQUEST BODY
========================================================= */

function readRequestBody(
  req
) {

  return new Promise(
    (resolve, reject) => {

      let body = "";

      let size = 0;


      req.on(
        "data",
        chunk => {

          size +=
            chunk.length;


          if (
            size >
            MAX_BODY_SIZE
          ) {

            reject(
              new Error(
                "Request body too large"
              )
            );


            req.destroy();

            return;
          }


          body +=
            chunk.toString();

        }
      );


      req.on(
        "end",
        () => {

          resolve(
            body
          );

        }
      );


      req.on(
        "error",
        error => {

          reject(
            error
          );

        }
      );

    }
  );
}


/* =========================================================
   REQUEST VALIDATION
========================================================= */

function validateEventData(
  eventData
) {

  if (
    !eventData ||
    typeof eventData !==
      "object" ||
    Array.isArray(eventData)
  ) {

    return {
      valid: false,
      error:
        "Request body must be an object"
    };
  }


  /*
   * Event is required for predictable
   * Chocolate Cupcake behavior.
   */

  if (
    !eventData.event
  ) {

    return {
      valid: false,
      error:
        "Missing required field: event"
    };
  }


  return {
    valid: true
  };
}


/* =========================================================
   HTTP SERVER
========================================================= */

const server =
  http.createServer(
    async (req, res) => {

      /*
       * CORS must be applied before any response.
       */

      applyCors(
        req,
        res
      );


      /* ---------------------------------------------------
         OPTIONS
      --------------------------------------------------- */

      if (
        req.method ===
        "OPTIONS"
      ) {

        res.statusCode =
          204;

        res.end();

        return;
      }


      /* ---------------------------------------------------
         HEALTH
      --------------------------------------------------- */

      if (
        req.method ===
          "GET" &&
        req.url ===
          "/health"
      ) {

        sendJson(
          res,
          200,
          {

            success: true,

            service:
              "chocolate-cupcake",

            status:
              "ok",

            agent:
              AGENT,

            model:
              MODEL ||
              "configured-default",

            openclaw:
              true

          }
        );

        return;
      }


      /* ---------------------------------------------------
         PLAYER MEMORY
      --------------------------------------------------- */

      if (
        req.method === "POST" &&
        req.url === "/api/memory"
      ) {

        try {
          const body = await readRequestBody(req);
          const parsed = body ? JSON.parse(body) : {};
          const memory = normalizeMemoryPayload(parsed);

          if (!memory.playerId && !memory.sessionId) {
            sendJson(res, 400, {
              success: false,
              error: "playerId or sessionId is required"
            });
            return;
          }

          saveMemoryPayload(memory);

          sendJson(res, 200, {
            success: true,
            stored: true,
            playerId: memory.playerId,
            sessionId: memory.sessionId,
            timestamp: memory.timestamp
          });

          return;

        } catch (error) {
          console.error(
            "[Chocolate Cupcake] Memory API error:",
            error.message
          );

          sendJson(res, 400, {
            success: false,
            error: "Invalid memory payload"
          });

          return;
        }
      }


      /* ---------------------------------------------------
         CUPCAKE RESPONSE
      --------------------------------------------------- */

      if (
        req.method ===
          "POST" &&
        req.url ===
          "/api/cupcake/respond"
      ) {

        try {

          const body =
            await readRequestBody(
              req
            );


          let eventData;


          try {

            eventData =
              body
                ? JSON.parse(body)
                : {};

          } catch (_) {

            sendJson(
              res,
              400,
              {

                success: false,

                error:
                  "Invalid JSON request body"

              }
            );

            return;
          }


          const validation =
            validateEventData(
              eventData
            );


          if (
            !validation.valid
          ) {

            sendJson(
              res,
              400,
              {

                success: false,

                error:
                  validation.error

              }
            );

            return;
          }


          console.log(
            "[Chocolate Cupcake] Event:",
            eventData.event
          );


          /*
           * Useful server-side logging.
           * Do not log full player profile or memory
           * because it may contain child-related data.
           */

          console.log(
            "[Chocolate Cupcake] Player:",
            eventData.playerName ||
            eventData.playerProfile?.player?.name ||
            "anonymous"
          );


          const result =
            await handleCupcake(
              eventData
            );


          sendJson(
            res,
            200,
            result
          );


          return;

        } catch (error) {

          console.error(
            "[Chocolate Cupcake] Request error:",
            error.message
          );


          if (
            !res.headersSent
          ) {

            sendJson(
              res,
              500,
              {

                success: false,

                error:
                  "Internal server error"

              }
            );
          }


          return;
        }
      }


      /* ---------------------------------------------------
         404
      --------------------------------------------------- */

      sendJson(
        res,
        404,
        {

          success: false,

          error:
            "Not found"

        }
      );

    }
  );


/* =========================================================
   SERVER TIMEOUTS
========================================================= */

server.requestTimeout =
  TIMEOUT + 10000;

server.timeout =
  TIMEOUT + 10000;

server.keepAliveTimeout =
  65000;

server.headersTimeout =
  66000;


/* =========================================================
   START
========================================================= */

server.listen(
  PORT,
  HOST,
  () => {

    console.log(
      "=============================================="
    );

    console.log(
      "🍫 Chocolate Cupcake AI Agent API"
    );

    console.log(
      "=============================================="
    );

    console.log(
      `Server: http://${HOST}:${PORT}`
    );

    console.log(
      `Agent: ${AGENT}`
    );

    console.log(
      `Model: ${
        MODEL ||
        "OpenClaw configured default"
      }`
    );

    console.log(
      `OpenClaw timeout: ${TIMEOUT}ms`
    );

    console.log(
      `Retries: ${RETRIES}`
    );

    console.log(
      "Endpoints:"
    );

    console.log(
      "  GET  /health"
    );

    console.log(
      "  POST /api/cupcake/respond"
    );

    console.log(
      "Allowed CORS origins:"
    );


    for (
      const origin of
      ALLOWED_ORIGINS
    ) {

      console.log(
        `  - ${origin}`
      );
    }


    console.log(
      "=============================================="
    );

  }
);


/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

function shutdown(
  signal
) {

  console.log(
    `[Chocolate Cupcake] ${signal} received. Shutting down...`
  );


  server.close(
    () => {

      console.log(
        "[Chocolate Cupcake] Server stopped."
      );

      process.exit(
        0
      );

    }
  );


  setTimeout(
    () => {

      process.exit(
        1
      );

    },
    10000
  ).unref();
}


process.on(
  "SIGTERM",
  () =>
    shutdown(
      "SIGTERM"
    )
);


process.on(
  "SIGINT",
  () =>
    shutdown(
      "SIGINT"
    )
);
