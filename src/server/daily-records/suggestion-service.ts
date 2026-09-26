import { randomUUID } from "node:crypto";
import { z } from "zod";
import { LocalDateSchema, SuggestionsResponseSchema, type SuggestionsResponse } from "@/contracts";
import { AppError } from "@/server/errors/app-error";
import { generateSuggestions } from "@/server/ai/suggestions";
import type { SupabaseClient } from "@/server/daily-records/types";
import { parseObject } from "@/server/validation";

const DateParamsSchema = z.strictObject({ date: LocalDateSchema });

export async function createSuggestions(
  supabase: SupabaseClient,
  userId: string,
  date: string,
): Promise<SuggestionsResponse> {
  const { date: localDate } = parseObject(DateParamsSchema, { date });
  const { data: record, error: recordError } = await supabase
    .from("daily_records")
    .select("id, record_status")
    .eq("user_id", userId)
    .eq("local_date", localDate)
    .maybeSingle();

  if (recordError) {
    throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
  }

  if (!record) {
    throw new AppError("RECORD_NOT_FOUND", "기록을 찾을 수 없습니다.", 404);
  }

  if (record.record_status === "confirmed") {
    throw new AppError("RECORD_CONFIRMED", "확정된 기록은 제안할 수 없습니다.", 409);
  }

  const { data: messages, error: messagesError } = await supabase
    .from("record_messages")
    .select("content")
    .eq("daily_record_id", record.id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
  }

  const aiResponse = await generateSuggestions(messages ?? []);

  const suggestions = aiResponse.suggestions.map((s) => ({
    id: randomUUID(),
    field: s.field,
    text: s.text,
  }));

  return SuggestionsResponseSchema.parse({ suggestions });
}
