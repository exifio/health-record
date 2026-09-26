import { z } from "zod";
import { LocalDateSchema } from "@/contracts";
import { parseObject } from "@/server/validation";

const DateRangeSchema = z.strictObject({
  from: LocalDateSchema,
  to: LocalDateSchema,
}).refine(({ from, to }) => from <= to, { path: ["to"] });

export function parseDateRange(input: { from: unknown; to: unknown }) {
  return parseObject(DateRangeSchema, input);
}
