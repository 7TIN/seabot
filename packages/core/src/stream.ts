export async function* parseSSE<T>(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<T> {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of readChunks(stream)) {
    buffer += decoder.decode(chunk, { stream: true });
    yield* drainBuffer<T>(buffer, (nextBuffer) => {
      buffer = nextBuffer;
    });
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const parsed = parseEventData(buffer);
    if (parsed !== undefined) {
      yield parsed as T;
    }
  }
}

async function* readChunks(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return;
      }

      if (value) {
        yield value;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function* drainBuffer<T>(
  content: string,
  setRemaining: (remaining: string) => void
): Generator<T> {
  let remaining = content;

  while (true) {
    const separatorIndex = remaining.search(/\r?\n\r?\n/);
    if (separatorIndex === -1) {
      break;
    }

    const eventBlock = remaining.slice(0, separatorIndex);
    const delimiterLength = remaining[separatorIndex] === "\r" ? 4 : 2;
    remaining = remaining.slice(separatorIndex + delimiterLength);

    const parsed = parseEventData(eventBlock);
    if (parsed !== undefined) {
      yield parsed as T;
    }
  }

  setRemaining(remaining);
}

function parseEventData(value: string): unknown | undefined {
  const dataLines = value
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim());

  if (dataLines.length === 0) {
    return undefined;
  }

  const rawData = dataLines.join("\n");
  if (!rawData) {
    return undefined;
  }

  return JSON.parse(rawData) as unknown;
}
