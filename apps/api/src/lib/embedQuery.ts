import { embedQuery as embedColab } from "./providers/colab.ts";
import { embedQuery as embedHuggingFace } from "./providers/huggingface.ts";
import { embedQuery as embedLocal } from "./providers/local.ts";

const providers: Record<string, (text: string) => Promise<number[]>> = {
  local: embedLocal,
  hf: embedHuggingFace,
  huggingface: embedHuggingFace,
  colab: embedColab,
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
