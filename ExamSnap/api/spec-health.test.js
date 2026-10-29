import { afterEach, describe, it, expect } from "vitest";
import handler from "./spec-health.js";

function mockRes() {
  return {
    statusCode: 0,
    body: null,
    setHeader() {},
    end(body) {
      this.body = JSON.parse(body);
    },
  };
}

describe("GET /api/spec-health", () => {
  const original = process.env.MODERATION_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.MODERATION_KEY;
    else process.env.MODERATION_KEY = original;
  });

  it("401s when no key is configured", async () => {
    delete process.env.MODERATION_KEY;
    const res = mockRes();
    await handler({ method: "GET", headers: { "x-moderation-key": "anything" } }, res);
    expect(res.statusCode).toBe(401);
  });

  it("401s on a wrong or differently-sized key", async () => {
    process.env.MODERATION_KEY = "secret-key";
    for (const supplied of ["", "nope", "secret-key-longer"]) {
      const res = mockRes();
      await handler({ method: "GET", headers: { "x-moderation-key": supplied } }, res);
      expect(res.statusCode).toBe(401);
    }
  });

  it("405s for writes once authorised (no DB needed)", async () => {
    process.env.MODERATION_KEY = "secret-key";
    const res = mockRes();
    await handler({ method: "POST", headers: { "x-moderation-key": "secret-key" } }, res);
    expect(res.statusCode).toBe(405);
  });
});
