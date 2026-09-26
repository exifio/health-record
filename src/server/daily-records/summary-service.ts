import { SummaryJobResponseSchema } from "@/contracts";
import { model } from "@/server/ai/client";
import { DAILY_SUMMARY_PROMPT_VERSION, summarizeDailyRecord } from "@/server/ai/daily-summary";
import type { SupabaseClient } from "@/server/daily-records/types";
import { AppError } from "@/server/errors/app-error";
import { hasLocalDayEnded } from "@/server/time/timezone-day";
import { localDateIn } from "@/server/time/timezone";

const PROCESSING_TIMEOUT_SECONDS = 15 * 60;
const CLAIMABLE_STATUSES = ["not_due", "pending", "stale", "failed", "processing"];

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
