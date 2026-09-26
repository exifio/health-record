import { summarizeDailyRecord } from "@/server/ai/daily-summary";
import { getDailyRecords } from "@/server/daily-records/daily-record-service";
import { getVisitPrep } from "@/server/daily-records/visit-prep-service";

jest.mock("@/server/ai/daily-summary", () => ({ summarizeDailyRecord: jest.fn() }));

const USER = "11111111-1111-4111-8111-111111111111";
const FROM = "2026-09-20";
const TO = "2026-09-25";
const RECORDS = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    local_date: "2026-09-23",
    record_status: "draft",
    summary_status: "ready",
    content_revision: 2,
    confirmed_at: null,
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    local_date: "2026-09-24",
    record_status: "draft",
    summary_status: "pending",
    content_revision: 1,
    confirmed_at: null,
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    local_date: "2026-09-25",
    record_status: "draft",
    summary_status: "not_due",
    content_revision: 1,
    confirmed_at: null,
  },
  {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    local_date: "2026-09-22",
    record_status: "confirmed",
    summary_status: "ready",
    content_revision: 4,
    confirmed_at: "2026-09-22T23:00:00Z",
  },
  {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    local_date: "2026-09-21",
    record_status: "confirmed",
    summary_status: "ready",
    content_revision: 1,
    confirmed_at: "2026-09-21T23:00:00Z",
  },
];

function makeSupabase(rows: Record<string, unknown[]>, errors: Record<string, unknown> = {}) {
  const calls: Array<{
    table: string;
    selected?: string;
    filters: Record<string, unknown>;
    orders: Array<{ column: string; ascending: boolean }>;
  }> = [];
  const client = {
    calls,
    from(table: string) {
      const call = {
        table,
        filters: {} as Record<string, unknown>,
        orders: [] as Array<{ column: string; ascending: boolean }>,
        selected: undefined as string | undefined,
      };
      const builder = {
        select(selected: string) { call.selected = selected; return builder; },
        eq(column: string, value: unknown) { call.filters[column] = value; return builder; },
        gte(column: string, value: unknown) { call.filters[`gte:${column}`] = value; return builder; },
        lte(column: string, value: unknown) { call.filters[`lte:${column}`] = value; return builder; },
        in(column: string, values: unknown[]) { call.filters[`in:${column}`] = values; return builder; },
        order(column: string, options: { ascending: boolean }) {
          call.orders.push({ column, ascending: options.ascending });
          return builder;
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          calls.push(call);
          const data = [...(rows[table] ?? [])] as Array<Record<string, unknown>>;
          for (const { column, ascending } of call.orders) {
            data.sort((left, right) => {
              const order = String(left[column] ?? "").localeCompare(String(right[column] ?? ""));
              return ascending ? order : -order;
            });
          }
          return Promise.resolve({ data, error: errors[table] ?? null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return client;
}

describe("B5 daily record list", () => {
  it("기간 내 기록만 내림차순으로 반환하고 확인 가능한 draft만 센다", async () => {
    const supabase = makeSupabase({
      daily_records: RECORDS,
      record_messages: [
        { daily_record_id: RECORDS[0].id },
        { daily_record_id: RECORDS[0].id },
        { daily_record_id: RECORDS[3].id },
      ],
    });

    const response = await getDailyRecords(supabase as never, USER, { from: FROM, to: TO });

    expect(response.unreviewedCount).toBe(1);
    expect(response.items.map((item) => item.date)).toEqual([
      "2026-09-25", "2026-09-24", "2026-09-23", "2026-09-22", "2026-09-21",
    ]);
    expect(response.items[2].messageCount).toBe(2);
    expect(supabase.calls[0].filters).toMatchObject({
      user_id: USER,
      "gte:local_date": FROM,
      "lte:local_date": TO,
    });
  });

  it("범위가 잘못되면 DB를 조회하지 않는다", async () => {
    const supabase = makeSupabase({ daily_records: [] });

    await expect(getDailyRecords(supabase as never, USER, { from: TO, to: FROM }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    expect(supabase.calls).toHaveLength(0);
  });

  it("기간에 record가 없으면 빈 응답을 반환한다", async () => {
    const supabase = makeSupabase({ daily_records: [] });
    await expect(getDailyRecords(supabase as never, USER, { from: FROM, to: TO }))
      .resolves.toEqual({ items: [], unreviewedCount: 0 });
    expect(supabase.calls).toHaveLength(1);
  });
});

describe("B5 visit preparation", () => {
  it("ready draft 날짜만 미확인으로 알리고 확정 요약·정정을 시간순으로 반환한다", async () => {
    const draftWithSummary = {
      daily_record_id: RECORDS[0].id,
      source_revision: 2,
      ai_draft: { timeline: [], medications: [], missingInformation: [] },
      user_final: null,
    };
    const confirmedSummary = {
      daily_record_id: RECORDS[3].id,
      source_revision: 4,
      ai_draft: { timeline: [{ text: "AI 초안", sourceMessageIds: [] }], medications: [], missingInformation: [] },
      user_final: { timeline: [{ text: "사용자가 확인한 내용", sourceMessageIds: [] }], medications: [], missingInformation: [] },
    };
    const earlierConfirmedSummary = {
      daily_record_id: RECORDS[4].id,
      source_revision: 1,
      ai_draft: { timeline: [{ text: "다른 날짜 기록", sourceMessageIds: [] }], medications: [], missingInformation: [] },
      user_final: null,
    };
    const correction = {
      id: "99999999-9999-4999-8999-999999999999",
      daily_record_id: RECORDS[3].id,
      content: "정정 기록",
      created_at: "2026-09-23T00:00:00Z",
    };
    const supabase = makeSupabase({
      daily_records: RECORDS,
      daily_summaries: [draftWithSummary, earlierConfirmedSummary, confirmedSummary],
      corrections: [correction],
    });

    const response = await getVisitPrep(supabase as never, USER, { from: FROM, to: TO });

    expect(response.unreviewed).toEqual({ count: 1, dates: ["2026-09-23"] });
    expect(response.confirmedRecords).toEqual([
      {
        date: "2026-09-21",
        summary: { timeline: [{ text: "다른 날짜 기록", sourceMessageIds: [] }] },
        corrections: [],
      },
      {
        date: "2026-09-22",
        summary: { timeline: [{ text: "사용자가 확인한 내용", sourceMessageIds: [] }] },
        corrections: [{
          id: correction.id,
          content: correction.content,
          createdAt: "2026-09-23T00:00:00.000Z",
        }],
      },
    ]);
    expect(summarizeDailyRecord).not.toHaveBeenCalled();
  });

  it("확정된 기록에 summary가 없거나 revision이 불일치하면 성공 응답으로 꾸미지 않는다", async () => {
    const summary = {
      daily_record_id: RECORDS[3].id,
      source_revision: 3,
      ai_draft: { timeline: [], medications: [], missingInformation: [] },
      user_final: null,
    };
    const supabase = makeSupabase({ daily_records: [RECORDS[3]], daily_summaries: [summary], corrections: [] });

    await expect(getVisitPrep(supabase as never, USER, { from: FROM, to: TO }))
      .rejects.toMatchObject({ code: "INTERNAL_ERROR", status: 500 });
  });

  it("no-record period에는 날짜를 만들어 넣지 않고 AI를 호출하지 않는다", async () => {
    const supabase = makeSupabase({ daily_records: [] });

    await expect(getVisitPrep(supabase as never, USER, { from: FROM, to: TO })).resolves.toEqual({
      range: { from: FROM, to: TO },
      unreviewed: { count: 0, dates: [] },
      confirmedRecords: [],
    });
    expect(supabase.calls).toHaveLength(1);
    expect(summarizeDailyRecord).not.toHaveBeenCalled();
  });
});
