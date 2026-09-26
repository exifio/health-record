import { DailySummaryContentSchema, VisitPrepResponseSchema } from "@/contracts";
import { AppError } from "@/server/errors/app-error";
import { mapDatabaseError } from "@/server/daily-records/errors";
import { parseDateRange } from "@/server/daily-records/date-range";
import type { SupabaseClient } from "@/server/daily-records/types";

type DateRangeRecord = {
  id: string;
  local_date: string;
  record_status: string;
  summary_status: string;
  content_revision: number;
};

type DbSummary = {
  daily_record_id: string;
  source_revision: number;
  ai_draft: unknown;
  user_final: unknown | null;
};

type DbCorrection = {
  id: string;
  daily_record_id: string;
  content: string;
  created_at: string;
};

function toIso(value: string): string {
  return new Date(value).toISOString();
}

export async function getVisitPrep(
  supabase: SupabaseClient,
  userId: string,
  rawRange: { from: unknown; to: unknown },
) {
  const range = parseDateRange(rawRange);
  const { data, error } = await supabase
    .from("daily_records")
    .select("id, local_date, record_status, summary_status, content_revision")
    .eq("user_id", userId)
    .gte("local_date", range.from)
    .lte("local_date", range.to)
    .order("local_date", { ascending: true });

  if (error) throw mapDatabaseError(error);

  const records = (data ?? []) as DateRangeRecord[];
  const confirmed = records.filter((record) => record.record_status === "confirmed");
  const unreviewedDates = records
    .filter((record) => record.record_status === "draft" && record.summary_status === "ready")
    .map((record) => record.local_date);

  if (confirmed.length === 0) {
    return VisitPrepResponseSchema.parse({
      range,
      unreviewed: { count: unreviewedDates.length, dates: unreviewedDates },
      confirmedRecords: [],
    });
  }

  const confirmedIds = confirmed.map((record) => record.id);
  const [summaryResult, correctionResult] = await Promise.all([
    supabase
      .from("daily_summaries")
      .select("daily_record_id, source_revision, ai_draft, user_final")
      .in("daily_record_id", confirmedIds),
    supabase
      .from("corrections")
      .select("id, daily_record_id, content, created_at")
      .in("daily_record_id", confirmedIds)
      .order("created_at", { ascending: true }),
  ]);

  if (summaryResult.error) throw mapDatabaseError(summaryResult.error);
  if (correctionResult.error) throw mapDatabaseError(correctionResult.error);

  const summaries = new Map(
    ((summaryResult.data ?? []) as DbSummary[]).map((summary) => [summary.daily_record_id, summary]),
  );
  const corrections = new Map<string, ReturnType<typeof VisitPrepResponseSchema.parse>["confirmedRecords"][number]["corrections"]>();
  for (const correction of (correctionResult.data ?? []) as DbCorrection[]) {
    const items = corrections.get(correction.daily_record_id) ?? [];
    items.push({ id: correction.id, content: correction.content, createdAt: toIso(correction.created_at) });
    corrections.set(correction.daily_record_id, items);
  }

  const confirmedRecords = confirmed.map((record) => {
    const summary = summaries.get(record.id);
    if (!summary || summary.source_revision !== record.content_revision) {
      throw new AppError("INTERNAL_ERROR", "요청을 처리하지 못했습니다.", 500);
    }

    const finalContent = DailySummaryContentSchema.parse(summary.user_final ?? summary.ai_draft);
    return {
      date: record.local_date,
      summary: { timeline: finalContent.timeline },
      corrections: corrections.get(record.id) ?? [],
    };
  });

  return VisitPrepResponseSchema.parse({
    range,
    unreviewed: { count: unreviewedDates.length, dates: unreviewedDates },
    confirmedRecords,
  });
}
