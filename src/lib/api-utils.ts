/**
 * Shared API response utilities
 * Provides consistent error handling, responses, and middleware patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { z } from 'zod';
import { logger } from './logger';

/**
 * Standard API response types
 */
export interface ApiSuccessResponse<T> {
    data: T;
}

export interface ApiErrorResponse {
    error: string;
    code?: string;
    details?: Record<string, string>;
}

/**
 * Creates a successful JSON response
 */
export function apiSuccess<T>(
    data: T,
    status: number = 200,
    headers?: HeadersInit
): NextResponse<T> {
    return NextResponse.json(data, { status, headers });
}

/**
 * Creates an error JSON response
 */
export function apiError(
    message: string,
    status: number = 500,
    code?: string
): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
        { error: message, ...(code && { code }) },
        { status }
    );
}

/**
 * Standard error codes
 */
export const ErrorCodes = {
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    RATE_LIMITED: 'RATE_LIMITED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

/**
 * Error response shortcuts
 */
export const ApiErrors = {
    unauthorized: () => apiError('Unauthorized', 401, ErrorCodes.UNAUTHORIZED),
    forbidden: () => apiError('Forbidden', 403, ErrorCodes.FORBIDDEN),
    notFound: (resource = 'Resource') => apiError(`${resource} not found`, 404, ErrorCodes.NOT_FOUND),
    validation: (message: string) => apiError(message, 400, ErrorCodes.VALIDATION_ERROR),
    rateLimited: () => apiError('Too many requests', 429, ErrorCodes.RATE_LIMITED),
    internal: (message = 'Internal server error') => apiError(message, 500, ErrorCodes.INTERNAL_ERROR),
};

/**
 * User type from session
 */
export interface AuthenticatedUser {
    id: string;
    email?: string | null;
    name?: string | null;
}

/**
 * Gets the authenticated user from session, or null if not authenticated
 */
export async function getAuthUser(): Promise<AuthenticatedUser | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return null;
    }
    return {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
    };
}

/**
 * Handler type for authenticated API routes
 */
type AuthenticatedHandler<T> = (
    user: AuthenticatedUser,
    request: NextRequest
) => Promise<NextResponse<T>>;

/**
 * Wraps an API handler with authentication check
 * Returns 401 if not authenticated
 */
export function withAuth<T>(
    handler: AuthenticatedHandler<T>
): (request: NextRequest) => Promise<NextResponse<T | ApiErrorResponse>> {
    return async (request: NextRequest) => {
        try {
            const user = await getAuthUser();
            if (!user) {
                return ApiErrors.unauthorized();
            }
            return await handler(user, request);
        } catch (error) {
            logger.error('API Error', {
                path: request.nextUrl.pathname,
                method: request.method,
                error,
            });
            return ApiErrors.internal();
        }
    };
}

/**
 * Parses and validates request body with Zod schema
 */
export async function parseRequestBody<T extends z.ZodSchema>(
    request: NextRequest,
    schema: T
): Promise<{ success: true; data: z.infer<T> } | { success: false; error: NextResponse<ApiErrorResponse> }> {
    try {
        const body = await request.json();
        const result = schema.safeParse(body);

        if (!result.success) {
            const errors = result.error.issues.map(issue => {
                const path = issue.path.join('.');
                return path ? `${path}: ${issue.message}` : issue.message;
            });
            return {
                success: false,
                error: ApiErrors.validation(errors.join('; '))
            };
        }

        return { success: true, data: result.data };
    } catch {
        return {
            success: false,
            error: ApiErrors.validation('Invalid JSON body')
        };
    }
}

/**
 * Parses URL search params into an object
 */
export function parseSearchParams(searchParams: URLSearchParams): Record<string, string> {
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
        params[key] = value;
    });
    return params;
}

export function generateRequestId(): string {
    return (
        globalThis.crypto?.randomUUID?.() ??
        `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    );
}

export function getRequestId(request: NextRequest): string {
    return request.headers.get('x-request-id') || generateRequestId();
}

export function attachRequestId<T>(response: NextResponse<T>, requestId: string): NextResponse<T> {
    response.headers.set('X-Request-Id', requestId);
    return response;
}
