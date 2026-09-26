import { z } from "zod";
import {
  LocalDateSchema,
  RetrySummaryResponseSchema,
  SummaryJobResponseSchema,
  type RetrySummaryResponse,
} from "@/contracts";
import { model } from "@/server/ai/client";
import { DAILY_SUMMARY_PROMPT_VERSION, summarizeDailyRecord } from "@/server/ai/daily-summary";
import type { SupabaseClient } from "@/server/daily-records/types";
import { AppError } from "@/server/errors/app-error";
import { mapDatabaseError } from "@/server/daily-records/errors";
import { hasLocalDayEnded } from "@/server/time/timezone-day";
import { localDateIn } from "@/server/time/timezone";
import { parseObject } from "@/server/validation";

const PROCESSING_TIMEOUT_SECONDS = 15 * 60;
const CLAIMABLE_STATUSES = ["not_due", "pending", "stale", "failed", "processing"];

const RetryParamsSchema = z.strictObject({ date: LocalDateSchema });

// API.md 9절: 재시도 가능 여부 판정은 DB RPC가 row lock 안에서 처리한다.
// 'pending' 중복 호출도 같은 202를 반환한다.
const RETRY_RESULTS = {
  pending: "pending",
  missing: "missing",
  not_retryable: "not_retryable",
} as const;

type DailyRecordCandidate = {
  id: string;
  local_date: string;
  timezone_at_creation: string;
  record_status: string;
  summary_status: string;
  content_revision: number;
  processing_started_at: string | null;
};

function shouldClaim(record: DailyRecordCandidate, now: Date): boolean {
  if (!hasLocalDayEnded(record.local_date, localDateIn(record.timezone_at_creation, now))) {
    return false;
  }

  if (record.summary_status !== "processing") {
    return true;
  }

  return record.processing_started_at !== null
    && Date.parse(record.processing_started_at) <= now.getTime() - PROCESSING_TIMEOUT_SECONDS * 1000;
}

export async function retryDailySummary(
  supabase: SupabaseClient,
  userId: string,
  rawDate: string,
): Promise<RetrySummaryResponse> {
  const { date } = parseObject(RetryParamsSchema, { date: rawDate });

  // 세션 클라이언트로 호출해 DB 안의 auth.uid() 검증이 실제로 작동하게 한다.
  const { data, error } = await supabase.rpc("retry_daily_summary", {
    p_user_id: userId,
    p_local_date: date,
  });

  if (error) {
    throw mapDatabaseError(error);
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (result === RETRY_RESULTS.missing) {
    throw new AppError("RECORD_NOT_FOUND", "기록을 찾을 수 없습니다.", 404);
  }
  if (result !== RETRY_RESULTS.pending) {
    throw new AppError("SUMMARY_NOT_RETRYABLE", "지금은 다시 정리할 수 없습니다.", 409);
  }

  return RetrySummaryResponseSchema.parse({ summaryStatus: "pending" });
}

export async function runDailySummaryJob(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("daily_records")
    .select("id, local_date, timezone_at_creation, record_status, summary_status, content_revision, processing_started_at")
    .eq("record_status", "draft")
    .in("summary_status", CLAIMABLE_STATUSES)
    .order("local_date", { ascending: true });

  if (error) {
    throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
  }

  const now = new Date();
  let claimedCount = 0;
  let completedCount = 0;
  let failedCount = 0;

  // ponytail: process all eligible records serially; add a bounded queue when the deployment runtime requires it.
  for (const record of (data ?? []) as DailyRecordCandidate[]) {
    if (!shouldClaim(record, now)) continue;

    const { data: claimRows, error: claimError } = await supabase.rpc("claim_daily_summary", {
      p_record_id: record.id,
      p_content_revision: record.content_revision,
      p_processing_timeout_seconds: PROCESSING_TIMEOUT_SECONDS,
    });

    if (claimError) {
      throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
    }

    const claim = Array.isArray(claimRows) ? claimRows[0] : null;
    if (!claim) continue;
    claimedCount += 1;

    try {
      const { data: sourceMessages, error: messagesError } = await supabase
        .from("record_messages")
        .select("id, content, created_at")
        .eq("daily_record_id", claim.record_id)
        .order("created_at", { ascending: true });

      if (messagesError || !sourceMessages?.length) {
        throw new Error("Unable to load summary source");
      }

      const messages = sourceMessages.map((message) => ({
        id: message.id,
        content: message.content,
        createdAt: new Date(message.created_at).toISOString(),
      }));
      const aiDraft = await summarizeDailyRecord(messages);
      const { data: completionRows, error: completionError } = await supabase.rpc("complete_daily_summary", {
        p_record_id: claim.record_id,
        p_source_revision: claim.content_revision,
        p_ai_draft: aiDraft,
        p_model: model,
        p_prompt_version: DAILY_SUMMARY_PROMPT_VERSION,
      });

      if (completionError) throw new Error("Unable to save summary");
      const result = Array.isArray(completionRows) ? completionRows[0]?.result : null;
      if (result === "ready") completedCount += 1;
      else failedCount += 1;
    } catch {
      const { error: failureError } = await supabase.rpc("fail_daily_summary", {
        p_record_id: claim.record_id,
        p_source_revision: claim.content_revision,
      });
      if (failureError) {
        throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
      }
      failedCount += 1;
    }
  }

  return SummaryJobResponseSchema.parse({
    claimed: claimedCount,
    completed: completedCount,
    failed: failedCount,
  });
}
