// src/lib/ai/provider.ts

import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Create a configured Google Generative AI provider instance.
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Configure the default model. Gemini 1.5 Flash is recommended for fast, cost-effective tool use.
export const defaultModel = google('gemini-1.5-flash');
