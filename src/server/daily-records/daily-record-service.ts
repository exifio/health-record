import { z } from "zod";
import {
  CreateMessageRequestSchema,
  CreateCorrectionRequestSchema,
  CreateCorrectionResponseSchema,
  ConfirmRecordResponseSchema,
  DailyRecordListResponseSchema,
  DailyRecordResponseSchema,
  LocalDateSchema,
  MessageMutationResponseSchema,
  UpdateSummaryRequestSchema,
  UpdateSummaryResponseSchema,
  UpdateMessageRequestSchema,
  UuidSchema,
  type DailyRecordResponse,
  type MessageMutationResponse,
} from "@/contracts";
import { AppError } from "@/server/errors/app-error";
import { mapDatabaseError } from "@/server/daily-records/errors";
import { isFutureDate, localDateIn } from "@/server/time/timezone";
import { parseObject } from "@/server/validation";
import { parseDateRange } from "@/server/daily-records/date-range";
import type { SupabaseClient } from "@/server/daily-records/types";

type DbMessage = {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type DbCorrection = { id: string; content: string; created_at: string };

const DateParamsSchema = z.strictObject({ date: LocalDateSchema });
const MessageParamsSchema = z.strictObject({ date: LocalDateSchema, messageId: UuidSchema });
const RECORD_SELECT = "id, local_date, record_status, summary_status, content_revision, timezone_at_creation";

function toIso(value: string): string {
  return new Date(value).toISOString();
}

export async function getDailyRecord(
  supabase: SupabaseClient,
  userId: string,
  rawDate: string,
): Promise<DailyRecordResponse> {
  const { date } = parseObject(DateParamsSchema, { date: rawDate });

  const { data: record, error } = await supabase
    .from("daily_records")
    .select(RECORD_SELECT)
    .eq("user_id", userId)
    .eq("local_date", date)
    .maybeSingle();

  if (error) {
    throw mapDatabaseError(error);
  }
  if (!record) {
    throw new AppError("RECORD_NOT_FOUND", "기록을 찾을 수 없습니다.", 404);
  }

  const { data: messages, error: messageError } = await supabase
    .from("record_messages")
    .select("id, content, created_at, updated_at")
    .eq("daily_record_id", record.id)
    .order("created_at", { ascending: true });

  if (messageError) {
    throw mapDatabaseError(messageError);
  }

  const { data: summary, error: summaryError } = await supabase
    .from("daily_summaries")
    .select("source_revision, ai_draft, user_final, generated_at")
    .eq("daily_record_id", record.id)
    .maybeSingle();

  if (summaryError) {
    throw mapDatabaseError(summaryError);
  }

  const { data: corrections, error: correctionsError } = await supabase
    .from("corrections")
    .select("id, content, created_at")
    .eq("daily_record_id", record.id)
    .order("created_at", { ascending: true });

  if (correctionsError) {
    throw mapDatabaseError(correctionsError);
  }

  return DailyRecordResponseSchema.parse({
    record: {
      date: record.local_date,
      recordStatus: record.record_status,
      summaryStatus: record.summary_status,
      contentRevision: record.content_revision,
      messages: (messages ?? []).map((message: DbMessage) => ({
        id: message.id,
        content: message.content,
        createdAt: toIso(message.created_at),
        updatedAt: toIso(message.updated_at),
      })),
      summary: summary ? {
        sourceRevision: summary.source_revision,
        aiDraft: summary.ai_draft,
        userFinal: summary.user_final,
        generatedAt: toIso(summary.generated_at),
      } : null,
      corrections: (corrections ?? []).map((correction: DbCorrection) => ({
        id: correction.id,
        content: correction.content,
        createdAt: toIso(correction.created_at),
      })),
    },
  });
}

export async function getDailyRecords(
  supabase: SupabaseClient,
  userId: string,
  rawRange: { from: unknown; to: unknown },
) {
  const range = parseDateRange(rawRange);
  const { data: records, error } = await supabase
    .from("daily_records")
    .select("id, local_date, record_status, summary_status, confirmed_at")
    .eq("user_id", userId)
    .gte("local_date", range.from)
    .lte("local_date", range.to)
    .order("local_date", { ascending: false });

  if (error) throw mapDatabaseError(error);
  if (!records?.length) return DailyRecordListResponseSchema.parse({ items: [], unreviewedCount: 0 });

  const { data: messages, error: messageError } = await supabase
    .from("record_messages")
    .select("daily_record_id")
    .in("daily_record_id", records.map((record) => record.id));

  if (messageError) throw mapDatabaseError(messageError);

  const messageCounts = new Map<string, number>();
  for (const message of messages ?? []) {
    messageCounts.set(message.daily_record_id, (messageCounts.get(message.daily_record_id) ?? 0) + 1);
  }

  return DailyRecordListResponseSchema.parse({
    items: records.map((record) => ({
      date: record.local_date,
      recordStatus: record.record_status,
      summaryStatus: record.summary_status,
      messageCount: messageCounts.get(record.id) ?? 0,
      confirmedAt: record.confirmed_at ? toIso(record.confirmed_at) : null,
    })),
    // Only a ready draft can be reviewed and confirmed now.
    unreviewedCount: records.filter((record) => record.record_status === "draft" && record.summary_status === "ready").length,
  });
}

export async function updateDailySummary(
  supabase: SupabaseClient,
  userId: string,
  input: { date: string; body: unknown },
) {
  const { date } = parseObject(DateParamsSchema, { date: input.date });
  const userFinal = parseObject(UpdateSummaryRequestSchema, input.body);
  const { data, error } = await supabase.rpc("update_daily_summary", {
    p_user_id: userId,
    p_local_date: date,
    p_user_final: userFinal,
  });

  if (error) throw mapDatabaseError(error);
  const summary = Array.isArray(data) ? data[0] : null;
  if (!summary) throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);

  return UpdateSummaryResponseSchema.parse({
    summary: {
      sourceRevision: summary.source_revision,
      aiDraft: summary.ai_draft,
      userFinal: summary.user_final,
      generatedAt: toIso(summary.generated_at),
    },
  });
}

export async function confirmDailyRecord(
  supabase: SupabaseClient,
  userId: string,
  rawDate: string,
) {
  const { date } = parseObject(DateParamsSchema, { date: rawDate });
  const { data, error } = await supabase.rpc("confirm_daily_record", {
    p_user_id: userId,
    p_local_date: date,
  });

  if (error) throw mapDatabaseError(error);
  const record = Array.isArray(data) ? data[0] : null;
  if (!record) throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);

  return ConfirmRecordResponseSchema.parse({
    recordStatus: record.record_status,
    confirmedAt: toIso(record.confirmed_at),
  });
}

export async function createCorrection(
  supabase: SupabaseClient,
  userId: string,
  input: { date: string; body: unknown },
) {
  const { date } = parseObject(DateParamsSchema, { date: input.date });
  const { content } = parseObject(CreateCorrectionRequestSchema, input.body);
  const { data, error } = await supabase.rpc("create_record_correction", {
    p_user_id: userId,
    p_local_date: date,
    p_content: content,
  });

  if (error) throw mapDatabaseError(error);
  const correction = Array.isArray(data) ? data[0] : null;
  if (!correction) throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);

  return CreateCorrectionResponseSchema.parse({
    correction: {
      id: correction.id,
      content: correction.content,
      createdAt: toIso(correction.created_at),
    },
  });
}

export async function createMessage(
  supabase: SupabaseClient,
  userId: string,
  input: { date: string; body: unknown },
): Promise<MessageMutationResponse> {
  const { date } = parseObject(DateParamsSchema, { date: input.date });
  const { content, systemTimeZone } = parseObject(CreateMessageRequestSchema, input.body);

  // 미래 날짜 기록 생성은 금지한다.
  if (isFutureDate(date, localDateIn(systemTimeZone))) {
    throw new AppError("VALIDATION_ERROR", "미래 날짜는 기록할 수 없습니다.", 400);
  }

  const { data, error } = await supabase.rpc("create_record_message", {
    p_user_id: userId,
    p_local_date: date,
    p_timezone: systemTimeZone,
    p_content: content,
  });

  if (error) {
    throw mapDatabaseError(error);
  }

  return buildMutationResponse(supabase, data[0]);
}

export async function updateMessage(
  supabase: SupabaseClient,
  userId: string,
  input: { date: string; messageId: string; body: unknown },
): Promise<MessageMutationResponse> {
  const { date, messageId } = parseObject(MessageParamsSchema, {
    date: input.date,
    messageId: input.messageId,
  });
  const { content } = parseObject(UpdateMessageRequestSchema, input.body);

  const { data, error } = await supabase.rpc("update_record_message", {
    p_user_id: userId,
    p_local_date: date,
    p_message_id: messageId,
    p_content: content,
  });

  if (error) {
    throw mapDatabaseError(error);
  }

  return buildMutationResponse(supabase, data[0]);
}

export async function deleteMessage(
  supabase: SupabaseClient,
  userId: string,
  input: { date: string; messageId: string },
): Promise<void> {
  const { date, messageId } = parseObject(MessageParamsSchema, input);

  const { error } = await supabase.rpc("delete_record_message", {
    p_user_id: userId,
    p_local_date: date,
    p_message_id: messageId,
  });

  if (error) {
    throw mapDatabaseError(error);
  }
}

export async function deleteDailyRecord(
  supabase: SupabaseClient,
  rawDate: string,
): Promise<void> {
  const { date } = parseObject(DateParamsSchema, { date: rawDate });
  const { error } = await supabase.rpc("delete_daily_record", { p_local_date: date });

  if (error) throw mapDatabaseError(error);
}

async function buildMutationResponse(
  supabase: SupabaseClient,
  mutation: { record_id: string; message_id: string; content_revision: number } | undefined,
): Promise<MessageMutationResponse> {
  if (!mutation) {
    throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
  }

  const { data: message, error: messageError } = await supabase
    .from("record_messages")
    .select("id, content, created_at, updated_at")
    .eq("id", mutation.message_id)
    .eq("daily_record_id", mutation.record_id)
    .maybeSingle();
  if (messageError || !message) {
    throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
  }

  const { data: record, error: recordError } = await supabase
    .from("daily_records")
    .select(RECORD_SELECT)
    .eq("id", mutation.record_id)
    .maybeSingle();
  if (recordError || !record) {
    throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
  }

  return MessageMutationResponseSchema.parse({
    message: {
      id: message.id,
      content: message.content,
      createdAt: toIso(message.created_at),
      updatedAt: toIso(message.updated_at),
    },
    record: {
      date: record.local_date,
      recordStatus: record.record_status,
      summaryStatus: record.summary_status,
      contentRevision: record.content_revision,
    },
  });
}
