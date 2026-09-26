const mockSummarize = jest.fn();

jest.mock("@/server/ai/daily-summary", () => ({
  summarizeDailyRecord: mockSummarize,
  DAILY_SUMMARY_PROMPT_VERSION: "daily-summary-v1",
}));

let runDailySummaryJob: typeof import("@/server/daily-records/summary-service").runDailySummaryJob;
beforeAll(async () => {
  ({ runDailySummaryJob } = await import("@/server/daily-records/summary-service"));
});

const RECORD_ID = "11111111-1111-4111-8111-111111111111";
const MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_REVISION = 4;
const aiDraft = {
  timeline: [{ text: "아침에 두통이 있었다고 기록함", sourceMessageIds: [MESSAGE_ID] }],
  medications: [],
  missingInformation: [],
};

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: RECORD_ID,
    local_date: "2026-09-25",
    timezone_at_creation: "Asia/Seoul",
    record_status: "draft",
    summary_status: "not_due",
    content_revision: SOURCE_REVISION,
    processing_started_at: null,
    ...overrides,
  };
}

function makeSupabase(records: Record<string, unknown>[], options: {
  messages?: Record<string, unknown>[];
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
} = {}) {
  const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
  const supabase = {
    from(tableName: string) {
      const filters: Record<string, unknown> = {};
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        },
        in: (column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        },
        order: () => Promise.resolve({
          data: tableName === "daily_records" ? records : options.messages ?? [],
          error: null,
        }),
      };
      return builder;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      if (options.rpc) return options.rpc(name, args);
      return { data: [], error: null };
    },
    rpcCalls,
  };
  return supabase;
}

describe("runDailySummaryJob", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-09-26T01:00:00.000Z"));
    jest.clearAllMocks();
    mockSummarize.mockResolvedValue(aiDraft);
  });

  afterEach(() => jest.useRealTimers());

  it("claims only records whose creation-time local day ended and recovers expired processing", async () => {
    const supabase = makeSupabase([
      record(),
      record({ id: "33333333-3333-4333-8333-333333333333", timezone_at_creation: "America/Los_Angeles", summary_status: "pending" }),
      record({ id: "44444444-4444-4444-8444-444444444444", summary_status: "processing", processing_started_at: "2026-09-26T00:59:00.000Z" }),
      record({ id: "55555555-5555-4555-8555-555555555555", summary_status: "processing", processing_started_at: "2026-09-26T00:40:00.000Z" }),
    ]);

    await expect(runDailySummaryJob(supabase as never)).resolves.toEqual({ claimed: 0, completed: 0, failed: 0 });

    expect(supabase.rpcCalls.map(({ args }) => args.p_record_id)).toEqual([
      RECORD_ID,
      "55555555-5555-4555-8555-555555555555",
    ]);
    expect(supabase.rpcCalls[0]).toMatchObject({
      name: "claim_daily_summary",
      args: { p_content_revision: SOURCE_REVISION, p_processing_timeout_seconds: 900 },
    });
    expect(mockSummarize).not.toHaveBeenCalled();
  });

  it("saves structured output with the claimed source revision and prompt/model metadata", async () => {
    const supabase = makeSupabase([record()], {
      messages: [{ id: MESSAGE_ID, content: "아침에 두통", created_at: "2026-09-25T00:20:00.000Z" }],
      rpc: async (name) => {
        if (name === "claim_daily_summary") return { data: [{ record_id: RECORD_ID, content_revision: SOURCE_REVISION }], error: null };
        if (name === "complete_daily_summary") return { data: "ready", error: null };
        return { data: [], error: null };
      },
    });

    await expect(runDailySummaryJob(supabase as never)).resolves.toEqual({ claimed: 1, completed: 1, failed: 0 });
    expect(mockSummarize).toHaveBeenCalledWith([
      { id: MESSAGE_ID, content: "아침에 두통", createdAt: "2026-09-25T00:20:00.000Z" },
    ]);
    expect(supabase.rpcCalls).toContainEqual({
      name: "complete_daily_summary",
      args: expect.objectContaining({
        p_record_id: RECORD_ID,
        p_source_revision: SOURCE_REVISION,
        p_ai_draft: aiDraft,
        p_model: "gpt-5-nano",
        p_prompt_version: "daily-summary-v1",
      }),
    });
  });

  it("counts a source revision race as uncompleted without overwriting the record", async () => {
    const supabase = makeSupabase([record()], {
      messages: [{ id: MESSAGE_ID, content: "아침에 두통", created_at: "2026-09-25T00:20:00.000Z" }],
      rpc: async (name) => name === "claim_daily_summary"
        ? { data: [{ record_id: RECORD_ID, content_revision: SOURCE_REVISION }], error: null }
        : { data: "stale", error: null },
    });

    await expect(runDailySummaryJob(supabase as never)).resolves.toEqual({ claimed: 1, completed: 0, failed: 1 });
    expect(supabase.rpcCalls.some(({ name }) => name === "fail_daily_summary")).toBe(false);
  });

  it("marks an AI failure for retry without returning source text", async () => {
    mockSummarize.mockRejectedValueOnce(new Error("synthetic health text must not escape"));
    const supabase = makeSupabase([record()], {
      messages: [{ id: MESSAGE_ID, content: "아침에 두통", created_at: "2026-09-25T00:20:00.000Z" }],
      rpc: async (name) => name === "claim_daily_summary"
        ? { data: [{ record_id: RECORD_ID, content_revision: SOURCE_REVISION }], error: null }
        : { data: "failed", error: null },
    });

    await expect(runDailySummaryJob(supabase as never)).resolves.toEqual({ claimed: 1, completed: 0, failed: 1 });
    expect(supabase.rpcCalls).toContainEqual({
      name: "fail_daily_summary",
      args: { p_record_id: RECORD_ID, p_source_revision: SOURCE_REVISION },
    });
  });

  it("returns text RPC의 실제 반환 형태(스칼라 문자열)로 완료 카운터를 센다", async () => {
    // PostgREST는 returns text 함수에 대해 배열이 아닌 스칼라 문자열을 돌려준다.
    // 원격 DB에서 retry_daily_summary가 "not_retryable" 문자열을 반환하는 것으로 확인했다.
    const supabase = makeSupabase([record()], {
      messages: [{ id: MESSAGE_ID, content: "아침에 두통", created_at: "2026-09-25T00:20:00.000Z" }],
      rpc: async (name) => name === "claim_daily_summary"
        ? { data: [{ record_id: RECORD_ID, content_revision: SOURCE_REVISION }], error: null }
        : { data: "ready", error: null },
    });

    await expect(runDailySummaryJob(supabase as never)).resolves.toEqual({ claimed: 1, completed: 1, failed: 0 });
  });

  it("예상하지 못한 반환 형태는 실패로 집계한다", async () => {
    const supabase = makeSupabase([record()], {
      messages: [{ id: MESSAGE_ID, content: "아침에 두통", created_at: "2026-09-25T00:20:00.000Z" }],
      rpc: async (name) => name === "claim_daily_summary"
        ? { data: [{ record_id: RECORD_ID, content_revision: SOURCE_REVISION }], error: null }
        : { data: null, error: null },
    });

    await expect(runDailySummaryJob(supabase as never)).resolves.toEqual({ claimed: 1, completed: 0, failed: 1 });
  });
});

export {};
