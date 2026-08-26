import { describe, expect, it } from "vitest";
import { redactContext } from "@/lib/logger";

describe("structured logging", () => {
  it("redacts sensitive fields and email values", () => {
    expect(
      redactContext({
        email: "jamie@example.test",
        address: "12 MG Road",
        message: "failed for jamie@example.test",
        orderId: "FC-1234ABCD",
      })
    ).toEqual({
      email: "[REDACTED]",
      address: "[REDACTED]",
      message: "failed for [REDACTED_EMAIL]",
      orderId: "FC-1234ABCD",
    });
  });
});
