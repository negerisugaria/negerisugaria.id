const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const AGENT = process.env.OPENCLAW_AGENT || "main";
const MODEL =
  process.env.OPENCLAW_MODEL ||
  "9router/openrouter/nvidia/nemotron-3-super-120b-a12b:free";

const ROOT = path.resolve(__dirname, "..");
const PROMPT_DIR = path.join(ROOT, "prompts");

const ALLOWED_STATES = new Set([
  "welcome",
  "thinking",
  "encouraging",
  "oops",
  "teaching",
  "celebrating",
  "victory"
]);

const ALLOWED_EMOTIONS = new Set([
  "friendly",
  "thinking",
  "encouraging",
  "concerned",
  "teaching",
  "happy",
  "excited"
]);

function readPrompt(name) {
  return fs.readFileSync(path.join(PROMPT_DIR, name), "utf8");
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

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders()
  });
  res.end(JSON.stringify(body, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";

    req.on("data", chunk => {
      data += chunk;

      if (data.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });

    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
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
    "\n\nNow respond to the game event. Return ONLY JSON."
  ].join("");
}

function runOpenClaw(prompt) {
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

    child.stdout.on("data", chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("OpenClaw request timed out"));
    }, 120000);

    child.on("error", err => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on("close", code => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(
          new Error(
            `OpenClaw exited with code ${code}: ${stderr.slice(0, 2000)}`
          )
        );
        return;
      }

      resolve(stdout);
    });
  });
}

function extractText(openclawOutput) {
  let outer;

  try {
    outer = JSON.parse(openclawOutput);
  } catch {
    throw new Error("OpenClaw returned invalid JSON");
  }

  const text = outer?.result?.payloads?.[0]?.text;

  if (typeof text !== "string" || !text.trim()) {
    throw new Error("OpenClaw response did not contain result.payloads[0].text");
  }

  return text.trim();
}

function parseAgentJson(text) {
  let candidate = text.trim();

  if (candidate.startsWith("```")) {
    candidate = candidate
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  try {
    return JSON.parse(candidate);
  } catch {}

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {}
  }

  throw new Error("Chocolate Cupcake did not return parseable JSON");
}

function normalizeResponse(data) {
  const response = {
    state: ALLOWED_STATES.has(data?.state) ? data.state : "thinking",
    message:
      typeof data?.message === "string" && data.message.trim()
        ? data.message.trim()
        : "Sebentar ya, aku sedang berpikir. 🍫",
    hint: typeof data?.hint === "string" ? data.hint.trim() : "",
    visual: {
      enabled: Boolean(data?.visual?.enabled),
      content:
        typeof data?.visual?.content === "string"
          ? data.visual.content.trim()
          : ""
    },
    speak: data?.speak !== false,
    emotion: ALLOWED_EMOTIONS.has(data?.emotion)
      ? data.emotion
      : "friendly"
  };

  return response;
}

async function handleCupcake(req, res) {
  let raw;

  try {
    raw = await readBody(req);
  } catch (error) {
    sendJson(res, 413, {
      success: false,
      error: error.message
    });
    return;
  }

  let eventData;

  try {
    eventData = JSON.parse(raw);
  } catch {
    sendJson(res, 400, {
      success: false,
      error: "Request body must be valid JSON"
    });
    return;
  }

  if (!eventData || typeof eventData !== "object") {
    sendJson(res, 400, {
      success: false,
      error: "Request body must be a JSON object"
    });
    return;
  }

  try {
    const prompt = buildPrompt(eventData);
    const output = await runOpenClaw(prompt);
    const text = extractText(output);
    const parsed = parseAgentJson(text);
    const response = normalizeResponse(parsed);

    sendJson(res, 200, {
      success: true,
      agent: "chocolate-cupcake",
      model: MODEL,
      response
    });
  } catch (error) {
    console.error(error);

    sendJson(res, 502, {
      success: false,
      error: "Chocolate Cupcake service failed",
      detail: error.message
    });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, {
      success: true,
      service: "chocolate-cupcake",
      status: "ok",
      model: MODEL
    });
    return;
  }

  if (
    req.method === "POST" &&
    req.url === "/api/cupcake/respond"
  ) {
    await handleCupcake(req, res);
    return;
  }

  sendJson(res, 404, {
    success: false,
    error: "Not found"
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Chocolate Cupcake API running at http://${HOST}:${PORT}`);
  console.log(`OpenClaw agent: ${AGENT}`);
  console.log(`Model: ${MODEL}`);
});
