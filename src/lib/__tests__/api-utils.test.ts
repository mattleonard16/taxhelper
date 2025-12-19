import { describe, it, expect } from 'vitest';
import {
    apiSuccess,
    apiError,
    ApiErrors,
    parseSearchParams,
} from '../api-utils';

describe('api-utils', () => {
    describe('apiSuccess', () => {
        it('should create a success response with default status 200', async () => {
            const data = { id: '1', name: 'Test' };
            const response = apiSuccess(data);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toEqual(data);
        });

        it('should create a success response with custom status', async () => {
            const data = { created: true };
            const response = apiSuccess(data, 201);

            expect(response.status).toBe(201);
        });

        it('should include custom headers when provided', async () => {
            const data = { id: '1' };
            const response = apiSuccess(data, 200, {
                'X-Custom-Header': 'test-value',
            });

            expect(response.headers.get('X-Custom-Header')).toBe('test-value');
        });
    });

    describe('apiError', () => {
        it('should create an error response with message and status', async () => {
            const response = apiError('Something went wrong', 500);

            expect(response.status).toBe(500);
            const body = await response.json();
            expect(body.error).toBe('Something went wrong');
        });

        it('should include error code when provided', async () => {
            const response = apiError('Validation failed', 400, 'VALIDATION_ERROR');

            const body = await response.json();
            expect(body.error).toBe('Validation failed');
            expect(body.code).toBe('VALIDATION_ERROR');
        });

        it('should default to status 500', async () => {
            const response = apiError('Error');
            expect(response.status).toBe(500);
        });
    });

    describe('ApiErrors', () => {
        it('unauthorized should return 401', () => {
            const response = ApiErrors.unauthorized();
            expect(response.status).toBe(401);
        });

        it('forbidden should return 403', () => {
            const response = ApiErrors.forbidden();
            expect(response.status).toBe(403);
        });

        it('notFound should return 404 with resource name', async () => {
            const response = ApiErrors.notFound('Transaction');
            expect(response.status).toBe(404);
            const body = await response.json();
            expect(body.error).toBe('Transaction not found');
        });

        it('validation should return 400', async () => {
            const response = ApiErrors.validation('Invalid input');
            expect(response.status).toBe(400);
            const body = await response.json();
            expect(body.code).toBe('VALIDATION_ERROR');
        });

        it('rateLimited should return 429', () => {
            const response = ApiErrors.rateLimited();
            expect(response.status).toBe(429);
        });

        it('internal should return 500 with custom message', async () => {
            const response = ApiErrors.internal('Database error');
            expect(response.status).toBe(500);
            const body = await response.json();
            expect(body.error).toBe('Database error');
        });
    });

    describe('parseSearchParams', () => {
        it('should convert URLSearchParams to object', () => {
            const params = new URLSearchParams();
            params.set('page', '1');
            params.set('limit', '20');
            params.set('type', 'SALES_TAX');

            const result = parseSearchParams(params);

            expect(result).toEqual({
                page: '1',
                limit: '20',
                type: 'SALES_TAX',
            });
        });

        it('should handle empty params', () => {
            const params = new URLSearchParams();
            const result = parseSearchParams(params);
            expect(result).toEqual({});
        });
    });
});
