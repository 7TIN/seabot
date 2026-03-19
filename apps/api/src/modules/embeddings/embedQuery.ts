const providers: Record<string, (text: string) => Promise<number[]>> = {
  local: async (text) =>
    (await import("./providers/local.ts")).embedQuery(text),
  hf: async (text) =>
    (await import("./providers/huggingface.ts")).embedQuery(text),
  huggingface: async (text) =>
    (await import("./providers/huggingface.ts")).embedQuery(text),
  colab: async (text) =>
    (await import("./providers/colab.ts")).embedQuery(text),
};

function resolveProvider(): string {
  const providerRaw = process.env.EMBEDDINGS_PROVIDER;
  if (!providerRaw) {
    throw new Error(
      "EMBEDDINGS_PROVIDER not set. Use local | huggingface | colab."
    );
  }
  return providerRaw.toLowerCase();
}

export async function embedQuery(text: string): Promise<number[]> {
  const provider = resolveProvider();
  const fn = providers[provider];
  if (!fn) {
    throw new Error(
      `Unknown EMBEDDINGS_PROVIDER "${provider}". Use local | huggingface | colab.`
    );
  }
  return fn(text);
}
