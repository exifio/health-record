import { z } from "zod";
import { AppError } from "@/server/errors/app-error";
import { parseJson, parseObject } from "@/server/validation";

const Body = z.strictObject({ content: z.string() });

describe("runtime validation (B-009)", () => {
  it("parses a valid body", () => {
    const body = { content: "오늘 아침 두통이 있어요" };
    expect(parseJson(Body, JSON.stringify(body))).toEqual(body);
  });

  it("rejects malformed JSON with VALIDATION_ERROR", () => {
    expect(() => parseJson(Body, "{content:")).toThrow(AppError);
    try {
      parseJson(Body, "{content:");
    } catch (error) {
      expect((error as AppError).code).toBe("VALIDATION_ERROR");
      expect((error as AppError).status).toBe(400);
    }
  });

  it("rejects unknown fields and wrong types", () => {
    expect(() => parseJson(Body, JSON.stringify({ content: "a", extra: 1 }))).toThrow(AppError);
    expect(() => parseJson(Body, JSON.stringify({ content: 1 }))).toThrow(AppError);
  });

  it("validates path and query values", () => {
    expect(parseObject(z.strictObject({ date: z.iso.date() }), { date: "2026-09-25" })).toEqual({
      date: "2026-09-25",
    });
    expect(() =>
      parseObject(z.strictObject({ date: z.iso.date() }), { date: "25-09-2026" }),
    ).toThrow(AppError);
  });

  it("never echoes submitted health text in the error", () => {
    try {
      parseJson(Body, JSON.stringify({ content: "비밀 증상 내용", extra: true }));
    } catch (error) {
      expect((error as AppError).message).not.toContain("비밀 증상 내용");
    }
  });
});
