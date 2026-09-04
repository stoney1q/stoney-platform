import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { defaultModel } from '@/lib/ai/provider';
import { getPermittedTools, buildSystemPrompt } from '@/lib/ai/orchestrator';
import { requirePermission, AuthError } from '@/lib/auth/guard';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { z } from 'zod';

export const maxDuration = 30; // 30 seconds max duration

// Zod schema for the incoming chat payload
const chatSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system', 'data', 'tool']),
      content: z.string().max(4000),
      id: z.string().optional(),
      name: z.string().optional(),
    })
  ).max(20),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Early Content-Length check (50KB limit)
    const contentLengthStr = req.headers.get('content-length');
    if (contentLengthStr) {
      const contentLength = parseInt(contentLengthStr, 10);
      if (contentLength > 50000) {
        return NextResponse.json({ error: 'Payload Too Large' }, { status: 413 });
      }
    }

    // 2. Authentication & Early RBAC ('ai:access')
    const user = await requirePermission('ai:access');

    // 3. Rate-limit check (10 req/min for AI endpoints)
    const ip = req.headers.get('x-forwarded-for') || 'unknown-ip';
    if (!checkRateLimit(`ai-${user.id}-${ip}`, 10, 60000)) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
    }

    // 4. Bounded body read (Stream) to prevent unconstrained memory buffering
    const reader = req.body?.getReader();
    let bodyText = '';
    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bodyText += decoder.decode(value, { stream: true });
        if (bodyText.length > 50000) {
          // Cancel stream and return 413
          await reader.cancel('Payload Too Large');
          return NextResponse.json({ error: 'Payload Too Large' }, { status: 413 });
        }
      }
      // Flush decoder
      bodyText += decoder.decode();
    }

    if (!bodyText) {
      return NextResponse.json({ error: 'Bad Request' }, { status: 400 });
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // 5. Zod schema validation
    const parsed = chatSchema.safeParse(parsedBody);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid Request Body', details: parsed.error.issues }, { status: 400 });
    }
    const { messages } = parsed.data;

    // 6. Trusted request context assembly
    // For global admins without a branch scope in token, they must pass branch scope in headers or fallback.
    // In Stoney, admin:global users still have a primary branchId assigned in user record, or they select it.
    // For AI copilot, we strictly enforce branch isolation by tying the copilot context to the user's branchId.
    const trustedContext = {
      userId: user.id,
      branchId: user.branchId,
      branchName: user.branch.name,
      permissions: user.permissions,
    };

    // 7. Tool Authorization
    const permittedTools = getPermittedTools(trustedContext);
    const systemPrompt = buildSystemPrompt(trustedContext);

    // 8. AI Orchestration
    const result = await streamText({
      model: defaultModel,
      system: systemPrompt,
      messages: messages as NonNullable<Parameters<typeof streamText>[0]['messages']>,
      tools: permittedTools,
      abortSignal: AbortSignal.timeout(25000), // Enforce strict 25s timeout
    });

    return 'toDataStreamResponse' in result ? (result as { toDataStreamResponse: () => Response }).toDataStreamResponse() : result.toTextStreamResponse();
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[AI_CHAT_ERROR]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
