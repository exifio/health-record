import type { z } from "zod";
import { AppError } from "@/server/errors/app-error";

const VALIDATION_ERROR_MESSAGE = "요청을 확인해주세요.";

export function parseJson<T>(schema: z.ZodType<T>, raw: string): T {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new AppError("VALIDATION_ERROR", VALIDATION_ERROR_MESSAGE, 400);
  }

  return parseObject(schema, value);
}

export function parseObject<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", VALIDATION_ERROR_MESSAGE, 400);
  }

  return result.data;
}
