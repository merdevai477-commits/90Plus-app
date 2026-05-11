/**
 * Estimates API cost saved based on input/output length.
 * Assuming average OpenAI pricing for estimation purposes:
 * $0.150 / 1M input tokens, $0.600 / 1M output tokens (GPT-4o mini estimates)
 * 1 token ~= 4 chars
 */

export function estimateCostSaved(input: string, output: string): number {
  const inputTokens = Math.ceil(input.length / 4);
  const outputTokens = Math.ceil(output.length / 4);

  const inputCost = (inputTokens / 1000000) * 0.15;
  const outputCost = (outputTokens / 1000000) * 0.60;

  return inputCost + outputCost;
}
