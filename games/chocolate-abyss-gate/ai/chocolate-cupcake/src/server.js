const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);

const AGENT = process.env.OPENCLAW_AGENT || "main";
const MODEL =
  process.env.OPENCLAW_MODEL ||
  "9router/openrouter/nvidia/nemotron-3-super-120b-a12b:free";

const TIMEOUT = Number(process.env.OPENCLAW_TIMEOUT || 45000);
const RETRIES = Number(process.env.OPENCLAW_RETRIES || 1);
const RETRY_DELAY = Number(
  process.env.OPENCLAW_RETRY_DELAY_MS || 2500
);

const ROOT = path.resolve(__dirname, "..");
const PROMPT_DIR = path.join(ROOT, "prompts");

const STATES = new Set([
  "welcome",
  "thinking",
  "encouraging",
  "oops",
  "teaching",
  "celebrating",
  "victory"
]);

const EMOTIONS = new Set([
  "friendly",
  "thinking",
  "encouraging",
  "concerned",
  "teaching",
  "happy",
  "excited"
]);

function readPrompt(file) {
  return fs.readFileSync(
    path.join(PROMPT_DIR, file),
    "utf8"
  );
}

const PROMPTS = {
  system: readPrompt("SYSTEM.md"),
  persona: readPrompt("PERSONA.md"),
  states: readPrompt("STATES.md"),
  behavior: readPrompt("BEHAVIOR.md"),
  format: readPrompt("RESPONSE-FORMAT.md")
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders()
  });

  res.end(JSON.stringify(data, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk.toString();

      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPrompt(eventData) {
  return [
    PROMPTS.system,
    "\n--- PERSONA ---\n",
    PROMPTS.persona,
    "\n--- STATES ---\n",
    PROMPTS.states,
    "\n--- BEHAVIOR ---\n",
    PROMPTS.behavior,
    "\n--- RESPONSE FORMAT ---\n",
    PROMPTS.format,
    "\n--- GAME EVENT ---\n",
    JSON.stringify(eventData, null, 2),
    "\n\nReturn ONLY JSON."
  ].join("");
}

function runOpenClawOnce(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "openclaw",
      [
        "agent",
        "--agent",
        AGENT,
        "--model",
        MODEL,
        "--message",
        prompt,
        "--json"
      ],
      {
        cwd: ROOT,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

    let stdout = "";
    let stderr = "";
    let finished = false;

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finishError(
        new Error(`OpenClaw timeout after ${TIMEOUT}ms`)
      );
    }, TIMEOUT);

    function finishError(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(error);
    }

    function finishSuccess(value) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(value);
    }

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.on("error", finishError);

    child.on("close", code => {
      if (finished) return;

      if (code !== 0) {
        finishError(
          new Error(
            `OpenClaw exited ${code}: ${stderr.slice(0, 1500)}`
          )
        );
        return;
      }

      finishSuccess(stdout);
    });
  });
}

async function runOpenClaw(prompt) {
  let lastError;

  for (let i = 0; i <= RETRIES; i++) {
    try {
      if (i > 0) {
        console.log(
          `[Cupcake] Retry ${i}/${RETRIES}`
        );

        await sleep(RETRY_DELAY);
      }

      return await runOpenClawOnce(prompt);
    } catch (error) {
      lastError = error;

      console.error(
        `[Cupcake] OpenClaw failed: ${error.message}`
      );
    }
  }

  throw lastError;
}

function extractText(output) {
  let result;

  try {
    result = JSON.parse(output);
  } catch {
    throw new Error("Invalid OpenClaw JSON");
  }

  const text = result?.result?.payloads?.[0]?.text;

  if (!text || typeof text !== "string") {
    throw new Error("OpenClaw text response missing");
  }

  return text.trim();
}

function parseJson(text) {
  let value = text.trim();

  if (value.startsWith("```")) {
    value = value
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  try {
    return JSON.parse(value);
  } catch {}

  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start >= 0 && end > start) {
    return JSON.parse(
      value.slice(start, end + 1)
    );
  }

  throw new Error("Agent JSON could not be parsed");
}

function normalize(data) {
  return {
    state: STATES.has(data?.state)
      ? data.state
      : "thinking",

    message:
      typeof data?.message === "string" &&
      data.message.trim()
        ? data.message.trim()
        : "Sebentar ya, aku sedang berpikir. 🍫",

    hint:
      typeof data?.hint === "string"
        ? data.hint.trim()
        : "",

    visual: {
      enabled: Boolean(data?.visual?.enabled),
      content:
        typeof data?.visual?.content === "string"
          ? data.visual.content.trim()
          : ""
    },

    speak: data?.speak !== false,

    emotion: EMOTIONS.has(data?.emotion)
      ? data.emotion
      : "friendly"
  };
}

/* =========================
   SAFE LOCAL FALLBACK
   ========================= */

function fallback(eventData) {
  const event = eventData?.event;

  if (event === "game_started") {
    return normalize({
      state: "welcome",
      message:
        "Hai! Aku Chocolate Cupcake. Yuk belajar matematika bersama! 🍫",
      hint: "",
      visual: {
        enabled: false,
        content: ""
      },
      speak: true,
      emotion: "friendly"
    });
  }

  if (
    event === "level_completed" ||
    event === "game_completed"
  ) {
    return normalize({
      state: "victory",
      message:
        "Selamat! Kamu berhasil menyelesaikan tantangan ini! 🏆",
      hint: "",
      visual: {
        enabled: true,
        content: "🏆"
      },
      speak: true,
      emotion: "excited"
    });
  }

  if (event === "answer_submitted") {
    const correct =
      eventData?.answer?.correct === true;

    if (correct) {
      return normalize({
        state: "celebrating",
        message:
          "Benar! Hebat sekali! 🍫🎉",
        hint: "",
        visual: {
          enabled: true,
          content: "🎉🍫"
        },
        speak: true,
        emotion: "excited"
      });
    }

    const attempt = Number(
      eventData?.attempt || 1
    );

    const question = eventData?.question || {};
    const a = question.a;
    const b = question.b;
    const operation =
      question.operation || "+";

    const validNumbers =
      Number.isFinite(Number(a)) &&
      Number.isFinite(Number(b));

    const expression = validNumbers
      ? `${a} ${operation} ${b}`
      : "";

    if (attempt <= 1) {
      return normalize({
        state: "encouraging",
        message:
          "Tidak apa-apa. Yuk coba lagi! Kamu pasti bisa! 💪",
        hint:
          "Coba hitung pelan-pelan.",
        visual: {
          enabled: validNumbers,
          content: expression
        },
        speak: true,
        emotion: "encouraging"
      });
    }

    if (attempt === 2) {
      return normalize({
        state: "teaching",
        message:
          "Ayo kita hitung bersama. Pecah soal menjadi bagian kecil.",
        hint:
          "Hitung satu bagian dulu.",
        visual: {
          enabled: validNumbers,
          content: validNumbers
            ? `${expression} = ?`
            : "🍫 + 🍫 = ?"
        },
        speak: true,
        emotion: "teaching"
      });
    }

    return normalize({
      state: "teaching",
      message:
        "Kita lakukan pelan-pelan. Hitung satu per satu ya.",
      hint:
        validNumbers
          ? `Mulai dari ${a}, lalu ${operation} ${b}.`
          : "Kerjakan langkah demi langkah.",
      visual: {
        enabled: validNumbers,
        content: validNumbers
          ? `${expression} = ?`
          : "🍫🍫 + 🍫🍫🍫 = ?"
      },
      speak: true,
      emotion: "teaching"
    });
  }

  return normalize({
    state: "thinking",
    message:
      "Sebentar ya, aku sedang berpikir. 🍫",
    hint: "",
    visual: {
      enabled: false,
      content: ""
    },
    speak: true,
    emotion: "thinking"
  });
}

/* =========================
   API
   ========================= */

async function handleCupcake(req, res) {
  let body;

  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, 413, {
      success: false,
      error: "Request body too large"
    });
  }

  let eventData;

  try {
    eventData = JSON.parse(body);
  } catch {
    return sendJson(res, 400, {
      success: false,
      error: "Request body must be valid JSON"
    });
  }

  if (
    !eventData ||
    typeof eventData !== "object" ||
    Array.isArray(eventData)
  ) {
    return sendJson(res, 400, {
      success: false,
      error: "Request body must be a JSON object"
    });
  }

  try {
    const prompt = buildPrompt(eventData);
    const output = await runOpenClaw(prompt);
    const text = extractText(output);
    const response = normalize(
      parseJson(text)
    );

    console.log(
      `[Cupcake] AI → ${response.state}`
    );

    return sendJson(res, 200, {
      success: true,
      agent: "chocolate-cupcake",
      model: MODEL,
      fallback: false,
      response
    });
  } catch (error) {
    console.error(
      `[Cupcake] AI unavailable → fallback`
    );

    const response = fallback(eventData);

    return sendJson(res, 200, {
      success: true,
      agent: "chocolate-cupcake",
      model: MODEL,
      fallback: true,
      response
    });
  }
}

const server = http.createServer(
  async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      return res.end();
    }

    if (
      req.method === "GET" &&
      req.url === "/health"
    ) {
      return sendJson(res, 200, {
        success: true,
        service: "chocolate-cupcake",
        status: "ok"
      });
    }

    if (
      req.method === "POST" &&
      req.url === "/api/cupcake/respond"
    ) {
      return handleCupcake(req, res);
    }

    return sendJson(res, 404, {
      success: false,
      error: "Not found"
    });
  }
);

server.listen(PORT, HOST, () => {
  console.log(
    `Chocolate Cupcake API running at http://${HOST}:${PORT}`
  );

  console.log(`Agent: ${AGENT}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Timeout: ${TIMEOUT}ms`);
  console.log(`Retries: ${RETRIES}`);
});
