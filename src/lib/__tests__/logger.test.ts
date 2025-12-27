import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, operationLogger, startTimer } from '../logger';

describe('logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('basic logger', () => {
    it('logs info messages to console.log', () => {
      logger.info('test message', { userId: 'user-1' });

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe('info');
      expect(logOutput.message).toBe('test message');
      expect(logOutput.userId).toBe('user-1');
      expect(logOutput.timestamp).toBeDefined();
    });

    it('logs error messages to console.error', () => {
      logger.error('error message', { requestId: 'req-123' });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logOutput.level).toBe('error');
      expect(logOutput.message).toBe('error message');
      expect(logOutput.requestId).toBe('req-123');
    });

    it('serializes Error objects', () => {
      const error = new Error('Test error');
      logger.error('error occurred', { error });

      const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(logOutput.error.name).toBe('Error');
      expect(logOutput.error.message).toBe('Test error');
    });
  });

  describe('operationLogger', () => {
    describe('receiptPipeline', () => {
      it('logs confirm events with correct fields', () => {
        operationLogger.receiptPipeline('confirm', {
          userId: 'user-1',
          jobId: 'job-123',
          fromStatus: 'COMPLETED',
          toStatus: 'CONFIRMED',
          transactionId: 'txn-456',
          durationMs: 150,
        });

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
        expect(logOutput.event).toBe('receipt.confirm');
        expect(logOutput.userId).toBe('user-1');
        expect(logOutput.jobId).toBe('job-123');
        expect(logOutput.fromStatus).toBe('COMPLETED');
        expect(logOutput.toStatus).toBe('CONFIRMED');
        expect(logOutput.transactionId).toBe('txn-456');
        expect(logOutput.durationMs).toBe(150);
      });

      it('logs retry events', () => {
        operationLogger.receiptPipeline('retry', {
          userId: 'user-1',
          jobId: 'job-123',
        });

        const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
        expect(logOutput.event).toBe('receipt.retry');
        expect(logOutput.jobId).toBe('job-123');
      });

      it('logs recover_stuck events with count', () => {
        operationLogger.receiptPipeline('recover_stuck', {
          count: 3,
          durationMs: 50,
        });

        const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
        expect(logOutput.event).toBe('receipt.recover_stuck');
        expect(logOutput.count).toBe(3);
        expect(logOutput.durationMs).toBe(50);
      });
    });

    describe('batchOperation', () => {
      it('logs successful update operations', () => {
        operationLogger.batchOperation('update', {
          requestId: 'req-123',
          userId: 'user-1',
          count: 25,
          durationMs: 120,
        });

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
        expect(logOutput.event).toBe('batch.update');
        expect(logOutput.requestId).toBe('req-123');
        expect(logOutput.userId).toBe('user-1');
        expect(logOutput.count).toBe(25);
        expect(logOutput.durationMs).toBe(120);
      });

      it('logs delete operations', () => {
        operationLogger.batchOperation('delete', {
          requestId: 'req-456',
          userId: 'user-2',
          count: 10,
          durationMs: 80,
        });

        const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
        expect(logOutput.event).toBe('batch.delete');
        expect(logOutput.count).toBe(10);
      });

      it('logs errors to console.error', () => {
        operationLogger.batchOperation('update', {
          requestId: 'req-789',
          userId: 'user-3',
          count: 0,
          durationMs: 30,
          errorCode: 'VALIDATION_ERROR',
        });

        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
        expect(logOutput.errorCode).toBe('VALIDATION_ERROR');
      });
    });

    describe('transactionSearch', () => {
      it('logs search with filters and result count', () => {
        operationLogger.transactionSearch({
          requestId: 'req-search',
          userId: 'user-1',
          filters: {
            hasDateRange: true,
            hasType: true,
            hasSearch: false,
            hasAmountRange: false,
            hasCategory: true,
            hasDeductible: false,
          },
          resultCount: 42,
          durationMs: 85,
        });

        expect(consoleLogSpy).toHaveBeenCalledTimes(1);
        const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
        expect(logOutput.event).toBe('transaction.search');
        expect(logOutput.filters.hasDateRange).toBe(true);
        expect(logOutput.filters.hasCategory).toBe(true);
        expect(logOutput.resultCount).toBe(42);
        expect(logOutput.durationMs).toBe(85);
      });
    });
  });

  describe('startTimer', () => {
    it('returns elapsed time in milliseconds', () => {
      const nowSpy = vi.spyOn(performance, 'now');
      nowSpy.mockReturnValueOnce(100).mockReturnValueOnce(125);

      const getElapsed = startTimer();
      const elapsed = getElapsed();

      expect(elapsed).toBe(25);
      nowSpy.mockRestore();
    });

    it('returns integer values', () => {
      const getElapsed = startTimer();
      const elapsed = getElapsed();
      
      expect(Number.isInteger(elapsed)).toBe(true);
    });
  });
});
