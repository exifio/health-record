import {
  CURRENT_CONSENT_VERSION,
  DailyRecordListResponseSchema,
  DailyRecordResponseSchema,
  ProfileResponseSchema,
  SuggestionsResponseSchema,
  VisitPrepResponseSchema,
  type DailyRecordListResponse,
  type DailyRecordResponse,
  type ProfileResponse,
  type SuggestionsResponse,
  type VisitPrepResponse,
} from "@/contracts";

export const sampleTodayRecordResponse: DailyRecordResponse = DailyRecordResponseSchema.parse({
  record: {
    date: "2026-09-25",
    recordStatus: "draft",
    summaryStatus: "not_due",
    contentRevision: 1,
    messages: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        content: "오전에 몸이 조금 피곤했어요.",
        createdAt: "2026-09-25T00:20:00Z",
        updatedAt: "2026-09-25T00:20:00Z",
      },
    ],
    summary: null,
    corrections: [],
  },
});

export const sampleYesterdayRecordResponse: DailyRecordResponse = DailyRecordResponseSchema.parse({
  record: {
    date: "2026-09-24",
    recordStatus: "confirmed",
    summaryStatus: "ready",
    contentRevision: 2,
    messages: [
      {
        id: "00000000-0000-4000-8000-000000000002",
        content: "오후 1시경 두통이 심해서 타이레놀 복용함",
        createdAt: "2026-09-24T04:10:00Z",
        updatedAt: "2026-09-24T04:10:00Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000003",
        content: "저녁 무렵 통증 가라앉음",
        createdAt: "2026-09-24T09:30:00Z",
        updatedAt: "2026-09-24T09:30:00Z",
      },
    ],
    summary: {
      sourceRevision: 2,
      aiDraft: {
        timeline: [
          {
            text: "오후 1시경 두통으로 진통제 복용",
            sourceMessageIds: ["00000000-0000-4000-8000-000000000002"],
          },
          {
            text: "저녁 무렵 증상 호전",
            sourceMessageIds: ["00000000-0000-4000-8000-000000000003"],
          },
        ],
        medications: [
          {
            name: "타이레놀",
            timeText: "오후 1시경",
            effectText: "저녁 무렵 통증 가라앉음",
            sourceMessageIds: ["00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000003"],
          },
        ],
        missingInformation: [],
      },
      userFinal: null,
      generatedAt: "2026-09-24T23:00:00Z",
    },
    corrections: [
      {
        id: "00000000-0000-4000-8000-000000000010",
        content: "복용한 약은 타이레놀 500mg 1정이었습니다.",
        createdAt: "2026-09-25T01:00:00Z",
      },
    ],
  },
});

export const sampleUnreviewedRecordResponse: DailyRecordResponse = DailyRecordResponseSchema.parse({
  record: {
    date: "2026-09-23",
    recordStatus: "draft",
    summaryStatus: "ready",
    contentRevision: 1,
    messages: [
      {
        id: "00000000-0000-4000-8000-000000000004",
        content: "저녁 식사 후 소화불량 및 속쓰림 증상 발생",
        createdAt: "2026-09-23T11:00:00Z",
        updatedAt: "2026-09-23T11:00:00Z",
      },
    ],
    summary: {
      sourceRevision: 1,
      aiDraft: {
        timeline: [
          {
            text: "저녁 식사 후 소화불량 및 속쓰림",
            sourceMessageIds: ["00000000-0000-4000-8000-000000000004"],
          },
        ],
        medications: [],
        missingInformation: [
          {
            field: "duration",
            text: "증상이 얼마나 지속되었는지 기록할 수 있어요.",
          },
        ],
      },
      userFinal: null,
      generatedAt: "2026-09-23T23:30:00Z",
    },
    corrections: [],
  },
});

/**
 * F-105: 둘러보기 기록 목록(`sampleDailyRecordListResponse`)의 2026-09-22 항목과 짝을 이루는 상세 샘플.
 * 목록에 보이는 날짜는 상세 화면에서도 같은 날짜의 샘플을 볼 수 있어야 한다.
 * 요약/원문은 `sampleVisitPrepResponse`의 2026-09-22 진료 준비 항목과 같은 내용을 쓴다.
 */
export const sampleOlderRecordResponse: DailyRecordResponse = DailyRecordResponseSchema.parse({
  record: {
    date: "2026-09-22",
    recordStatus: "confirmed",
    summaryStatus: "ready",
    contentRevision: 1,
    messages: [
      {
        id: "00000000-0000-4000-8000-000000000005",
        content: "아침에 일어나니 머리가 조금 아팠어요.",
        createdAt: "2026-09-22T00:30:00Z",
        updatedAt: "2026-09-22T00:30:00Z",
      },
    ],
    summary: {
      sourceRevision: 1,
      aiDraft: {
        timeline: [
          {
            text: "아침 기상 시 가벼운 두통",
            sourceMessageIds: ["00000000-0000-4000-8000-000000000005"],
          },
        ],
        medications: [],
        missingInformation: [],
      },
      userFinal: null,
      generatedAt: "2026-09-22T23:00:00Z",
    },
    corrections: [],
  },
});

// Backward-compatible alias for existing tests
export const sampleDailyRecordResponse = sampleTodayRecordResponse;

export const sampleDailyRecordListResponse: DailyRecordListResponse = DailyRecordListResponseSchema.parse({
  items: [
    {
      date: "2026-09-25",
      recordStatus: "draft",
      summaryStatus: "not_due",
      messageCount: 1,
      confirmedAt: null,
    },
    {
      date: "2026-09-24",
      recordStatus: "confirmed",
      summaryStatus: "ready",
      messageCount: 2,
      confirmedAt: "2026-09-24T23:59:00Z",
    },
    {
      date: "2026-09-23",
      recordStatus: "draft",
      summaryStatus: "ready",
      messageCount: 1,
      confirmedAt: null,
    },
    {
      date: "2026-09-22",
      recordStatus: "confirmed",
      summaryStatus: "ready",
      messageCount: 1,
      confirmedAt: "2026-09-22T23:00:00Z",
    },
  ],
  unreviewedCount: 1,
});

export const sampleSuggestionsResponse: SuggestionsResponse = SuggestionsResponseSchema.parse({
  suggestions: [
    {
      id: "00000000-0000-4000-8000-000000000020",
      field: "onset_time",
      text: "언제쯤 시작되었는지 기록할 수 있어요.",
    },
    {
      id: "00000000-0000-4000-8000-000000000021",
      field: "duration",
      text: "얼마나 지속되었는지 기록할 수 있어요.",
    },
  ],
});

export const sampleVisitPrepResponse: VisitPrepResponse = VisitPrepResponseSchema.parse({
  range: {
    from: "2026-09-01",
    to: "2026-09-25",
  },
  unreviewed: {
    count: 1,
    dates: ["2026-09-23"],
  },
  confirmedRecords: [
    {
      date: "2026-09-24",
      summary: {
        timeline: [
          {
            text: "오후 1시경 두통으로 진통제 복용",
            sourceMessageIds: ["00000000-0000-4000-8000-000000000002"],
          },
          {
            text: "저녁 무렵 증상 호전",
            sourceMessageIds: ["00000000-0000-4000-8000-000000000003"],
          },
        ],
      },
      corrections: [
        {
          id: "00000000-0000-4000-8000-000000000010",
          content: "복용한 약은 타이레놀 500mg 1정이었습니다.",
          createdAt: "2026-09-25T01:00:00Z",
        },
      ],
    },
    {
      date: "2026-09-22",
      summary: {
        timeline: [
          {
            text: "아침 기상 시 가벼운 두통",
            sourceMessageIds: ["00000000-0000-4000-8000-000000000005"],
          },
        ],
      },
      corrections: [],
    },
  ],
});

export const sampleProfileResponse: ProfileResponse = ProfileResponseSchema.parse({
  onboardingCompleted: true,
  consentVersion: CURRENT_CONSENT_VERSION,
});

export const demoDailyRecordResponse: DailyRecordResponse = DailyRecordResponseSchema.parse({
  record: {
    date: "2026-09-25",
    recordStatus: "draft",
    summaryStatus: "ready",
    contentRevision: 3,
    messages: [
      {
        id: "00000000-0000-4000-8000-000000000031",
        content: "오전에 두통이 약간 있어서 따뜻한 물을 마셨어요.",
        createdAt: "2026-09-25T01:30:00Z",
        updatedAt: "2026-09-25T01:30:00Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000032",
        content: "오후 1시경 타이레놀 1정을 복용했습니다.",
        createdAt: "2026-09-25T04:10:00Z",
        updatedAt: "2026-09-25T04:10:00Z",
      },
      {
        id: "00000000-0000-4000-8000-000000000033",
        content: "저녁 무렵 통증이 많이 완화되었어요.",
        createdAt: "2026-09-25T09:40:00Z",
        updatedAt: "2026-09-25T09:40:00Z",
      },
    ],
    summary: {
      sourceRevision: 3,
      aiDraft: {
        timeline: [
          {
            text: "오전 두통 발생 후 따뜻한 물 음용",
            sourceMessageIds: ["00000000-0000-4000-8000-000000000031"],
          },
          {
            text: "오후 1시경 타이레놀 1정 복용",
            sourceMessageIds: ["00000000-0000-4000-8000-000000000032"],
          },
          {
            text: "저녁 무렵 통증 완화",
            sourceMessageIds: ["00000000-0000-4000-8000-000000000033"],
          },
        ],
        medications: [
          {
            name: "타이레놀",
            timeText: "오후 1시경",
            effectText: "저녁 무렵 통증 완화",
            sourceMessageIds: ["00000000-0000-4000-8000-000000000032", "00000000-0000-4000-8000-000000000033"],
          },
        ],
        missingInformation: [],
      },
      userFinal: null,
      generatedAt: "2026-09-25T10:00:00Z",
    },
    corrections: [],
  },
});
