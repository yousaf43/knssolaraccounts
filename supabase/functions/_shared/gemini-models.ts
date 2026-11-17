// Google retires older Gemini models for new API keys; try current models first and fall back on 404 (model unavailable).
export const GEMINI_TEXT_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'] as const;
export const isLegacyGemini = (model: string) => model.startsWith('gemini-2.');
export async function withGeminiModel(run: (model: string) => Promise<Response>) {
  let response: Response = new Response(null, { status: 404 });
  for (const model of GEMINI_TEXT_MODELS) {
    response = await run(model);
    if (response.status !== 404) return response;
    await response.body?.cancel();
  }
  return new Response(null, { status: 404 });
}
