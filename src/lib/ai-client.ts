import Anthropic from '@anthropic-ai/sdk'

// Model is configured via ANTHROPIC_AI_MODEL env var so it can be changed
// without a redeploy. Falls back to a known-good model if unset.
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

export const AI_MODEL = process.env.ANTHROPIC_AI_MODEL ?? DEFAULT_MODEL

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  timeout: 30_000, // 30s — prevents hung requests when Claude API is slow/down
  maxRetries: 1,   // one automatic retry on transient errors (429, 529, network)
})

/**
 * Wrap an anthropic API call with a clear error for model-not-found (404).
 * Without this, a retired model produces an opaque "Not Found" error.
 */
export async function callAI<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err: unknown) {
    // Surface which model failed so the env var fix is obvious in logs
    if (err instanceof Anthropic.NotFoundError) {
      throw new Error(
        `AI model not found: "${AI_MODEL}". ` +
        `Update ANTHROPIC_AI_MODEL in .env.local to a valid model ID.`
      )
    }
    throw err
  }
}
