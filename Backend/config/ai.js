import OpenAI from "openai";
import { runChat } from "../lib/aiService.js";
import { SERVICES } from "./aiServices.js";

// Shared Gemini client (OpenAI-compatible endpoint)
export const AI = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

export const AI_MODEL = "gemini-2.5-flash";

// Pull the first {...} JSON object out of a model reply, tolerating ```json fences
const extractJSON = (text) => {
  if (!text) throw new Error("empty response");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object found");
  return JSON.parse(body.slice(start, end + 1));
};

/**
 * Ask Gemini for a JSON answer and return it parsed.
 *
 * Routes through the central AI accounting layer (runChat) so every call is
 * tracked on ai_requests. Callers must pass `service` and `userId` for
 * attribution; `meta` carries correlation ids (resumeId/jobId).
 *
 * @param {object}   opts
 * @param {string}   opts.prompt       - full instruction; describe the shape you want
 * @param {string}   opts.service      - service key from config/aiServices.js SERVICES
 * @param {string}   opts.userId       - Clerk user id for attribution
 * @param {object}   [opts.meta]       - { resumeId, jobId } for correlation
 * @param {function} [opts.validate]   - (obj) => boolean; reject bad shapes, triggers one retry
 * @param {number}   [opts.maxTokens]  - default 2000
 * @param {number}   [opts.temperature]- default 0 for repeatable results
 * @returns {Promise<object>}
 * @throws  {Error}  "AI returned an invalid response" after one failed retry
 */
const HARD_TOKEN_CAP = 16000;

export const generateJSON = async ({
  prompt,
  validate,
  maxTokens = 2000,
  temperature = 0,
  service = SERVICES.OTHER,
  userId,
  meta = {},
  schemaVersion = null,
}) => {
  const ask = async (tokens) => {
    const { res } = await runChat({
      service,
      userId,
      meta,
      schemaVersion,
      reasoning_effort: "none",
      response_format: { type: "json_object" },
      temperature,
      max_tokens: tokens,
      messages: [
        {
          role: "system",
          content:
            "You are a careful assistant. Reply with a single valid JSON object and nothing else — no prose, no markdown fences.",
        },
        { role: "user", content: prompt },
      ],
    });
    // The model ran out of room before finishing the JSON — flag it clearly
    // instead of letting extractJSON throw a cryptic "Expected ',' or ']'".
    if (res.choices?.[0]?.finish_reason === "length")
      throw new Error("truncated: response exceeded max_tokens");
    const obj = extractJSON(res.choices?.[0]?.message?.content);
    if (validate && !validate(obj)) throw new Error("failed validation");
    return obj;
  };

  try {
    return await ask(maxTokens);
  } catch (first) {
    // If the first failure looks like truncation (explicit flag or a JSON parse
    // error from a cut-off body), retry with a bigger ceiling. max_tokens is only
    // a cap — billed per real output token — so raising it is free unless used.
    const looksTruncated = /truncated|JSON|Expected|Unexpected|position \d/i.test(first.message);
    const retryTokens = looksTruncated
      ? Math.min(Math.round(maxTokens * 1.6), HARD_TOKEN_CAP)
      : maxTokens;
    try {
      return await ask(retryTokens);
    } catch (second) {
      console.error("generateJSON failed twice:", first.message, "|", second.message);
      throw new Error("AI returned an invalid response");
    }
  }
};
