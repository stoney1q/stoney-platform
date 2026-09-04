import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError } from '@/lib/auth/guard';
import { checkRateLimit } from './rate-limit';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Adjust for production if needed
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

type ApiHandler = (
  req: NextRequest,
  context: unknown
) => Promise<NextResponse> | NextResponse;

export function apiHandler(handler: ApiHandler) {
  return async (req: NextRequest, context: unknown) => {
    // Handle OPTIONS requests automatically for CORS
    if (req.method === 'OPTIONS') {
      return NextResponse.json({}, { headers: corsHeaders });
    }

    try {
      // 1. Rate Limiting
      const ip = req.headers.get('x-forwarded-for') || (req as unknown as { ip?: string }).ip || 'anonymous';

      // Limit to 100 requests per minute per IP
      const isAllowed = checkRateLimit(ip, 100, 60000);
      if (!isAllowed) {
        return NextResponse.json(
          { error: 'Too many requests' },
          { status: 429, headers: corsHeaders }
        );
      }

      // 2. Execute Handler
      const response = await handler(req, context);

      // Append CORS headers to the successful response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;

    } catch (error: unknown) {
      console.error('[API Error]', error);

      // 3. Error Mapping
      if (error instanceof AuthError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.statusCode, headers: corsHeaders }
        );
      }

      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: (error as unknown as { errors?: unknown[], issues?: unknown[] }).errors || error.issues },
          { status: 400, headers: corsHeaders }
        );
      }

      // Handle Prisma errors like "Record not found" or "Unique constraint"
      if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
        if (error.code === 'P2025') {
          return NextResponse.json(
            { error: 'Record not found' },
            { status: 404, headers: corsHeaders }
          );
        }
        if (error.code === 'P2002') {
          return NextResponse.json(
            { error: 'Unique constraint violation. A record with this value already exists.' },
            { status: 409, headers: corsHeaders }
          );
        }
      }

      // 4. Fallback 500
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500, headers: corsHeaders }
      );
    }
  };
}
