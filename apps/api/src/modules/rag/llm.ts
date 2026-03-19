type LlmProvider = "gemini" | "kimi" | "qwen";

export type LlmRequest = {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
};

export type LlmResponse = {
  text: string;
  raw: unknown;
  provider: LlmProvider;
  model: string;
};

const DEFAULT_TIMEOUT_MS = 30_000;

function getProvider(): LlmProvider {
  const raw = process.env.LLM_PROVIDER;
  if (!raw) {
    throw new Error("LLM_PROVIDER not set. Use gemini | kimi | qwen.");
  }
  const provider = raw.toLowerCase() as LlmProvider;
  if (!["gemini", "kimi", "qwen"].includes(provider)) {
    throw new Error("LLM_PROVIDER must be gemini | kimi | qwen.");
  }
  return provider;
}

function getModel(provider: LlmProvider): string {
  const envModel = process.env.LLM_MODEL;
  if (envModel) return envModel;
  if (provider === "gemini") {
    return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  }
  if (provider === "kimi") {
    return process.env.KIMI_MODEL ?? "moonshot-v1-8k";
  }
  return process.env.QWEN_MODEL ?? "qwen-max";
}

function getApiKey(provider: LlmProvider): string {
  if (provider === "gemini") {
    return process.env.GEMINI_API_KEY ?? "";
  }
  if (provider === "kimi") {
    return process.env.KIMI_API_KEY ?? process.env.LLM_API_KEY ?? "";
  }
  return process.env.QWEN_API_KEY ?? process.env.LLM_API_KEY ?? "";
}

function getBaseUrl(provider: LlmProvider): string {
  if (provider === "kimi") {
    return process.env.KIMI_BASE_URL ?? "https://api.moonshot.ai/v1";
  }
  if (provider === "qwen") {
    return (
      process.env.QWEN_BASE_URL ??
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
    );
  }
  return "https://generativelanguage.googleapis.com/v1beta";
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithGemini(
  req: LlmRequest,
  model: string,
  apiKey: string
): Promise<LlmResponse> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not set.");
  }

  const url = `${getBaseUrl("gemini")}/models/${model}:generateContent`;
  const body = {
    system_instruction: {
      parts: [{ text: req.system }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: req.user }],
      },
    ],
    generationConfig: {
      temperature: req.temperature ?? 0.2,
      maxOutputTokens: req.maxTokens ?? 800,
    },
  };

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Gemini error ${res.status}: ${JSON.stringify(raw)}`
    );
  }

  const text =
    raw?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("") ?? "";

  return { text, raw, provider: "gemini", model };
}

async function generateWithOpenAICompat(
  req: LlmRequest,
  provider: "kimi" | "qwen",
  model: string,
  apiKey: string
): Promise<LlmResponse> {
  if (!apiKey) {
    throw new Error(`${provider.toUpperCase()} API key not set.`);
  }

  const baseUrl = getBaseUrl(provider);
  const url = `${baseUrl}/chat/completions`;
  const body = {
    model,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    temperature: req.temperature ?? 0.2,
    max_tokens: req.maxTokens ?? 800,
  };

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `${provider} error ${res.status}: ${JSON.stringify(raw)}`
    );
  }

  const text =
    raw?.choices?.[0]?.message?.content ??
    raw?.choices?.[0]?.text ??
    "";

  return { text, raw, provider, model };
}

export async function generateAnswer(req: LlmRequest): Promise<LlmResponse> {
  const provider = getProvider();
  const model = getModel(provider);
  const apiKey = getApiKey(provider);

  if (provider === "gemini") {
    return generateWithGemini(req, model, apiKey);
  }
  if (provider === "kimi") {
    return generateWithOpenAICompat(req, "kimi", model, apiKey);
  }
  return generateWithOpenAICompat(req, "qwen", model, apiKey);
}
