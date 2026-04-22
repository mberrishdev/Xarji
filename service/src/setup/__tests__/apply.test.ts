import { describe, test, expect } from "bun:test";
import { applySetup, type ApplyProgress } from "../apply";

/**
 * applySetup touches the filesystem + a real InstantDB app, so we can't
 * unit-test the happy path hermetically. These tests cover the one pure
 * branch that matters most for UX: field validation running before any
 * side effect.
 */

describe("applySetup — validation gate", () => {
  test("invalid field map fails immediately at 'validate', nothing written", async () => {
    const progress: ApplyProgress[] = [];
    const result = await applySetup(
      {
        instantAppId: "not-a-uuid",
        instantAdminToken: "too-short",
        bankSenderIds: [],
      },
      { onProgress: (p) => void progress.push(p) }
    );

    expect(result.ok).toBe(false);
    expect(result.failedAt).toBe("validate");
    expect(result.completed).toEqual([]);
    expect(result.fieldErrors).toBeDefined();
    expect(Object.keys(result.fieldErrors!).sort()).toEqual([
      "bankSenderIds",
      "instantAdminToken",
      "instantAppId",
    ]);

    // onProgress fired exactly once with ok=false at the validate step,
    // and no filesystem / network step ran.
    expect(progress.length).toBe(1);
    expect(progress[0].step).toBe("validate");
    expect(progress[0].ok).toBe(false);
  });

  test("missing fields are treated as validation failures, not crashes", async () => {
    const result = await applySetup({}, {});
    expect(result.ok).toBe(false);
    expect(result.failedAt).toBe("validate");
    expect(result.fieldErrors).toBeDefined();
  });

  test("partial valid map still fails fast when any field is invalid", async () => {
    const result = await applySetup({
      instantAppId: "12345678-1234-1234-1234-123456789abc",
      instantAdminToken: "a".repeat(30),
      bankSenderIds: [], // empty → invalid
    });
    expect(result.ok).toBe(false);
    expect(result.failedAt).toBe("validate");
    expect(result.fieldErrors).toHaveProperty("bankSenderIds");
    expect(result.fieldErrors).not.toHaveProperty("instantAppId");
    expect(result.fieldErrors).not.toHaveProperty("instantAdminToken");
  });
});
