import { AiServiceError, friendlyAiErrorMessage } from "@/lib/article-errors";

const HF_INFERENCE_URL = "https://router.huggingface.co/hf-inference/models";

export const DEFAULT_IMAGE_MODEL =
  process.env.HUGGINGFACE_IMAGE_MODEL ?? "black-forest-labs/FLUX.1-schnell";

/** Таймаут ожидания ответа от Hugging Face (мс). */
export const HUGGINGFACE_TIMEOUT_MS = 240_000;

type HuggingFaceErrorResponse = {
  error?: string;
  estimated_time?: number;
};

function detectImageMimeType(contentType: string | null, bytes: Uint8Array): string {
  if (contentType?.startsWith("image/")) {
    return contentType.split(";")[0]?.trim() ?? "image/png";
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }

  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return "image/webp";
  }

  return "image/png";
}

export async function generateImageFromPrompt(
  prompt: string,
  model = DEFAULT_IMAGE_MODEL,
): Promise<{ dataUrl: string; mimeType: string }> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey) {
    throw new AiServiceError(
      friendlyAiErrorMessage(undefined, "HUGGINGFACE_API_KEY не задан"),
    );
  }

  const parameters =
    model.includes("FLUX.1-schnell")
      ? { num_inference_steps: 4, width: 1024, height: 1024 }
      : { width: 1024, height: 1024 };

  let response: Response;

  try {
    response = await fetch(`${HF_INFERENCE_URL}/${model}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters,
      }),
      signal: AbortSignal.timeout(HUGGINGFACE_TIMEOUT_MS),
    });

    const contentType = response.headers.get("content-type");

    if (!response.ok) {
      let errorMessage: string | undefined;

      if (contentType?.includes("application/json")) {
        const data = (await response.json()) as HuggingFaceErrorResponse;
        errorMessage = data.error;
      } else {
        errorMessage = await response.text();
      }

      throw new AiServiceError(
        friendlyAiErrorMessage(response.status, errorMessage),
      );
    }

    if (contentType?.includes("application/json")) {
      const data = (await response.json()) as HuggingFaceErrorResponse;

      throw new AiServiceError(
        friendlyAiErrorMessage(undefined, data.error ?? "Hugging Face не вернул изображение"),
      );
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    if (bytes.length === 0) {
      throw new AiServiceError(
        friendlyAiErrorMessage(undefined, "Hugging Face вернул пустой ответ"),
      );
    }

    const mimeType = detectImageMimeType(contentType, bytes);
    const base64 = Buffer.from(bytes).toString("base64");

    return {
      mimeType,
      dataUrl: `data:${mimeType};base64,${base64}`,
    };
  } catch (error) {
    if (error instanceof AiServiceError) {
      throw error;
    }

    throw new AiServiceError(
      friendlyAiErrorMessage(undefined, String(error)),
    );
  }
}
