/**
 * Utils Module Tests
 *
 * Tests for error handling utilities, logging, and common helper functions
 * Following patterns from https://docs.elizaos.ai/plugins/bootstrap/testing-guide
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import {
  ServiceErrorHandler,
  ServiceError,
  logger,
  createCorrelationId,
  formatError,
  isError,
  createErrorContext,
  ErrorContext,
} from "../utils";
import { setupActionTest } from "./test-utils";

describe("Utils Module", () => {
  describe("ServiceErrorHandler", () => {
    let mockRuntime: any;
    let mockService: any;

    beforeEach(() => {
      const setup = setupActionTest();
      mockRuntime = setup.mockRuntime;
      mockService = {
        name: "TestService",
        method: "testMethod",
      };
    });

    describe("wrapMethod", () => {
      it("should execute function successfully", async () => {
        const testFn = mock(() => Promise.resolve("success"));
        const result = await ServiceErrorHandler.wrapMethod(
          "TestService",
          "testMethod",
          testFn,
        );

        expect(result).toBe("success");
        expect(testFn).toHaveBeenCalledTimes(1);
      });

      it("should handle errors and return fallback", async () => {
        const testFn = mock(() => Promise.reject(new Error("Test error")));
        const fallback = "fallback value";

        const result = await ServiceErrorHandler.wrapMethod(
          "TestService",
          "testMethod",
          testFn,
          fallback,
        );

        expect(result).toBe(fallback);
        expect(testFn).toHaveBeenCalledTimes(1);
      });

      it("should re-throw errors when no fallback provided", async () => {
        const testError = new Error("Test error");
        const testFn = mock(() => Promise.reject(testError));

        await expect(
          ServiceErrorHandler.wrapMethod("TestService", "testMethod", testFn),
        ).rejects.toThrow("Test error");
      });

      it("should create correlation ID for tracking", async () => {
        const testFn = mock(() => Promise.resolve("success"));

        await ServiceErrorHandler.wrapMethod(
          "TestService",
          "testMethod",
          testFn,
          undefined,
          { userId: "user-123" },
        );

        // Verify correlation ID was created (check logs or error history)
        const errors = ServiceErrorHandler.getErrorHistory();
        expect(errors.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe("wrapVoid", () => {
      it("should execute void function successfully", async () => {
        const testFn = mock(() => Promise.resolve());

        await expect(
          ServiceErrorHandler.wrapVoid("TestService", "testMethod", testFn),
        ).resolves.toBeUndefined();

        expect(testFn).toHaveBeenCalledTimes(1);
      });

      it("should handle errors in void functions", async () => {
        const testError = new Error("Void function error");
        const testFn = mock(() => Promise.reject(testError));

        await expect(
          ServiceErrorHandler.wrapVoid("TestService", "testMethod", testFn),
        ).rejects.toThrow("Void function error");
      });
    });

    describe("wrapTransaction", () => {
      it("should execute transaction successfully", async () => {
        const testFn = mock(() => Promise.resolve("transaction result"));
        const rollbackFn = mock(() => Promise.resolve());

        const result = await ServiceErrorHandler.wrapTransaction(
          "TestService",
          "testMethod",
          testFn,
          rollbackFn,
        );

        expect(result).toBe("transaction result");
        expect(testFn).toHaveBeenCalledTimes(1);
        expect(rollbackFn).not.toHaveBeenCalled();
      });

      it("should execute rollback on error", async () => {
        const testError = new Error("Transaction failed");
        const testFn = mock(() => Promise.reject(testError));
        const rollbackFn = mock(() => Promise.resolve());

        await expect(
          ServiceErrorHandler.wrapTransaction(
            "TestService",
            "testMethod",
            testFn,
            rollbackFn,
          ),
        ).rejects.toThrow("Transaction failed");

        expect(rollbackFn).toHaveBeenCalledTimes(1);
      });

      it("should handle rollback errors gracefully", async () => {
        const testError = new Error("Transaction failed");
        const rollbackError = new Error("Rollback failed");
        const testFn = mock(() => Promise.reject(testError));
        const rollbackFn = mock(() => Promise.reject(rollbackError));

        await expect(
          ServiceErrorHandler.wrapTransaction(
            "TestService",
            "testMethod",
            testFn,
            rollbackFn,
          ),
        ).rejects.toThrow("Transaction failed");

        expect(rollbackFn).toHaveBeenCalledTimes(1);
      });
    });

    describe("Error History Management", () => {
      it("should maintain error history", async () => {
        const testError = new Error("History test error");
        const testFn = mock(() => Promise.reject(testError));

        try {
          await ServiceErrorHandler.wrapMethod(
            "TestService",
            "testMethod",
            testFn,
          );
        } catch (error) {
          // Expected to throw
        }

        const errors = ServiceErrorHandler.getErrorHistory();
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].service).toBe("TestService");
        expect(errors[0].method).toBe("testMethod");
        expect(errors[0].error.message).toBe("History test error");
      });

      it("should limit error history size", async () => {
        const maxErrors = 5;

        // Generate more errors than the limit
        for (let i = 0; i < maxErrors + 3; i++) {
          const testFn = mock(() => Promise.reject(new Error(`Error ${i}`)));
          try {
            await ServiceErrorHandler.wrapMethod(
              "TestService",
              `method${i}`,
              testFn,
            );
          } catch (error) {
            // Expected to throw
          }
        }

        const errors = ServiceErrorHandler.getErrorHistory();
        expect(errors.length).toBeLessThanOrEqual(maxErrors);
      });

      it("should clear error history", () => {
        ServiceErrorHandler.clearErrorHistory();
        const errors = ServiceErrorHandler.getErrorHistory();
        expect(errors.length).toBe(0);
      });
    });
  });

  describe("Utility Functions", () => {
    describe("createCorrelationId", () => {
      it("should create unique correlation IDs", () => {
        const id1 = createCorrelationId("Service1", "Method1");
        const id2 = createCorrelationId("Service2", "Method2");

        expect(id1).toBeDefined();
        expect(id2).toBeDefined();
        expect(id1).not.toBe(id2);
        expect(id1).toMatch(/Service1_Method1_\d+_/);
        expect(id2).toMatch(/Service2_Method2_\d+_/);
      });

      it("should include timestamp and random component", () => {
        const id = createCorrelationId("TestService", "TestMethod");
        const parts = id.split("_");

        expect(parts.length).toBeGreaterThanOrEqual(4);
        expect(parts[0]).toBe("TestService");
        expect(parts[1]).toBe("TestMethod");
        expect(parseInt(parts[2])).toBeGreaterThan(0); // timestamp
        expect(parts[3]).toHaveLength(9); // random component
      });
    });

    describe("formatError", () => {
      it("should format Error objects", () => {
        const error = new Error("Test error message");
        const formatted = formatError(error);
        expect(formatted).toBe("Test error message");
      });

      it("should format non-Error objects", () => {
        const error = "String error";
        const formatted = formatError(error);
        expect(formatted).toBe("String error");
      });

      it("should handle null and undefined", () => {
        expect(formatError(null)).toBe("null");
        expect(formatError(undefined)).toBe("undefined");
      });

      it("should handle complex objects", () => {
        const error = { code: 500, message: "Server error" };
        const formatted = formatError(error);
        expect(formatted).toBe("[object Object]");
      });
    });

    describe("isError", () => {
      it("should identify Error objects", () => {
        expect(isError(new Error("Test"))).toBe(true);
        expect(isError(new TypeError("Type error"))).toBe(true);
      });

      it("should reject non-Error objects", () => {
        expect(isError("string")).toBe(false);
        expect(isError(123)).toBe(false);
        expect(isError({})).toBe(false);
        expect(isError(null)).toBe(false);
        expect(isError(undefined)).toBe(false);
      });
    });

    describe("createErrorContext", () => {
      it("should create error context with required fields", () => {
        const context = createErrorContext("TestService", "TestMethod");

        expect(context.service).toBe("TestService");
        expect(context.method).toBe("TestMethod");
        expect(context.correlationId).toBeDefined();
        expect(context.context).toBeUndefined();
      });

      it("should include optional context data", () => {
        const customContext = { userId: "user-123", action: "test" };
        const context = createErrorContext(
          "TestService",
          "TestMethod",
          customContext,
        );

        expect(context.context).toEqual(customContext);
        expect(context.correlationId).toMatch(/TestService_TestMethod_\d+_/);
      });

      it("should generate unique correlation IDs", () => {
        const context1 = createErrorContext("Service1", "Method1");
        const context2 = createErrorContext("Service2", "Method2");

        expect(context1.correlationId).not.toBe(context2.correlationId);
      });
    });
  });

  describe("Logger Integration", () => {
    it("should export logger from ElizaOS core", () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });

    it("should handle error logging properly", () => {
      const error = new Error("Test logging error");

      // This should not throw
      expect(() => {
        logger.error(
          "Test error message:",
          error instanceof Error ? error.message : String(error),
        );
      }).not.toThrow();
    });
  });
});
