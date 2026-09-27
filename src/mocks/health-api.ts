import { API_ERROR_CODES, HealthApiError } from "@/features/records/api/health-api";
import {
  ConfirmRecordResponseSchema,
  CURRENT_CONSENT_VERSION,
  CreateCorrectionRequestSchema,
  CreateCorrectionResponseSchema,
  CreateMessageRequestSchema,
  DailyRecordListResponseSchema,
  DailyRecordResponseSchema,
  LocalDateSchema,
  MessageMutationResponseSchema,
  ProfileResponseSchema,
  RetrySummaryResponseSchema,
  SuggestionsResponseSchema,
  UpdateMessageRequestSchema,
  UpdateProfileRequestSchema,
  UpdateSummaryRequestSchema,
  UpdateSummaryResponseSchema,
  UuidSchema,
  VisitPrepResponseSchema,
  type ConfirmRecordResponse,
  type CreateCorrectionRequest,
  type CreateCorrectionResponse,
  type CreateMessageRequest,
  type DailyRecordListResponse,
  type DailyRecordResponse,
  type DailySummaryContent,
  type LocalDate,
  type MessageMutationResponse,
  type ProfileResponse,
  type RetrySummaryResponse,
  type SummaryStatus,
  type SuggestionsResponse,
  type UpdateMessageRequest,
  type UpdateProfileRequest,
  type UpdateSummaryRequest,
  type UpdateSummaryResponse,
  type VisitPrepResponse,
} from "@/contracts";
import type { HealthApi } from "@/features/records/api/health-api";
import {
  sampleDailyRecordListResponse,
  sampleOlderRecordResponse,
  sampleProfileResponse,
  sampleSuggestionsResponse,
  sampleTodayRecordResponse,
  sampleUnreviewedRecordResponse,
  sampleVisitPrepResponse,
  sampleYesterdayRecordResponse,
} from "@/mocks/fixtures";

export type MockHealthApi = HealthApi & {
  /**
   * Mock 전용 — 실제 서버의 일일 요약 job(B3 스케줄러)을 대신해 초안을 생성한다.
   * HealthApi contract에는 없는 함수이므로 화면 코드에서 호출하지 않고 테스트/데모만 부른다.
   * claim 규칙은 실제 job과 같다: draft record 중 summary_status가
   * not_due/pending/stale/failed이고 원문이 남아 있을 때만 정리한다.
   */
  runSummaryWorker: () => Promise<void>;
};

/** 실제 job이 claim하는 summary 상태 목록(B3). ready/processing은 여기서 처리하지 않는다. */
const CLAIMABLE_SUMMARY_STATUSES: SummaryStatus[] = ["not_due", "pending", "stale", "failed"];

/**
 * 재시도로 pending 되돌릴 수 있는 상태(B7 `retry_daily_summary`).
 * 확정 기록과 not_due/processing/ready는 거절된다(API.md 9절).
 */
const RETRYABLE_SUMMARY_STATUSES: SummaryStatus[] = ["failed", "stale", "pending"];

/** Mock이 원문만 근거로 만들어 내는 초안. 실제 AI 초안과 형태가 같은 timeline 항목만 사용한다. */
function buildSummaryDraft(record: DailyRecordResponse["record"]): DailySummaryContent {
  return {
    timeline: record.messages.map((message) => ({
      text: message.content,
      sourceMessageIds: [message.id],
    })),
    medications: [],
    missingInformation: [],
  };
}

/** 실제 DB 함수 규칙(B1): summary_status가 ready일 때만 원문 변경을 stale로 바꾼다. */
function markSummaryStale(record: DailyRecordResponse["record"]): void {
  if (record.summaryStatus === "ready") {
    record.summaryStatus = "stale";
  }
}

interface MockStore {
  records: Map<LocalDate, DailyRecordResponse["record"]>;
  /** 확정 시각은 contract 응답(list item)에만 노출되고 record에는 없어 Mock 내부 저장소를 따로 둔다. */
  confirmedAt: Map<LocalDate, string>;
  profile: ProfileResponse;
  suggestions: SuggestionsResponse;
  visitPrep: VisitPrepResponse;
}

function createDefaultStore(): MockStore {
  const records = new Map<LocalDate, DailyRecordResponse["record"]>();
  const confirmedAt = new Map<LocalDate, string>();

  // F-105: 둘러보기 Demo는 기록 목록 fixture와 같은 날짜의 상세 샘플을 함께 제공해야 한다.
  // 목록에 보이는 날짜를 눌렀는데 "기록이 없습니다"가 나오면 샘플이 서로 어긋난다.
  // (샘플 날짜는 fixture 4건으로 고정한다. 실행 시점 날짜에 같은 원문을 복제하면
  //  같은 기록 내용이 두 날짜에 중복으로 보인다.)
  for (const sample of [
    sampleTodayRecordResponse,
    sampleYesterdayRecordResponse,
    sampleUnreviewedRecordResponse,
    sampleOlderRecordResponse,
  ]) {
    const record = JSON.parse(JSON.stringify(sample.record)) as DailyRecordResponse["record"];
    records.set(record.date, record);
    // 확정된 샘플은 목록에서도 확정으로 보이도록 확정 시각을 함께 채운다.
    if (record.recordStatus === "confirmed") {
      confirmedAt.set(record.date, `${record.date}T23:00:00Z`);
    }
  }

  return {
    records,
    confirmedAt,
    profile: JSON.parse(JSON.stringify(sampleProfileResponse)),
    suggestions: JSON.parse(JSON.stringify(sampleSuggestionsResponse)),
    visitPrep: JSON.parse(JSON.stringify(sampleVisitPrepResponse)),
  };
}

export function createMockHealthApi(customStore?: Partial<MockStore>): MockHealthApi {
  const store: MockStore = {
    ...createDefaultStore(),
    ...customStore,
  };

  return {
    async getDailyRecord(date: LocalDate): Promise<DailyRecordResponse> {
      const requestedDate = LocalDateSchema.parse(date);
      const record = store.records.get(requestedDate);
      if (!record) {
        throw new HealthApiError(API_ERROR_CODES.recordNotFound, 404, "기록을 찾을 수 없습니다.");
      }
      return DailyRecordResponseSchema.parse({ record: JSON.parse(JSON.stringify(record)) });
    },

    async getDailyRecords(from: LocalDate, to: LocalDate): Promise<DailyRecordListResponse> {
      const validFrom = LocalDateSchema.parse(from);
      const validTo = LocalDateSchema.parse(to);

      // fixture 목록은 고정 샘플이고, Mock으로 새로 만든 기록은 저장소에만 있다.
      // 오늘 화면(샘플 오늘 기록)과 목록이 서로 다른 날짜를 보여 주지 않도록 저장소 기록을 합친다.
      const known = new Set(sampleDailyRecordListResponse.items.map((item) => item.date));
      const fromStore = [...store.records.values()]
        .filter((record) => record.date >= validFrom && record.date <= validTo && !known.has(record.date))
        .map((record) => ({
          date: record.date,
          recordStatus: record.recordStatus,
          summaryStatus: record.summaryStatus,
          messageCount: record.messages.length,
          confirmedAt: store.confirmedAt.get(record.date) ?? null,
        }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));

      return DailyRecordListResponseSchema.parse({
        items: [...fromStore, ...sampleDailyRecordListResponse.items],
        unreviewedCount:
          sampleDailyRecordListResponse.unreviewedCount +
          fromStore.filter((item) => item.recordStatus === "draft" && item.summaryStatus === "ready").length,
      });
    },

    async createMessage(date: LocalDate, input: CreateMessageRequest): Promise<MessageMutationResponse> {
      const validDate = LocalDateSchema.parse(date);
      const validInput = CreateMessageRequestSchema.parse(input);

      let record = store.records.get(validDate);
      const now = new Date().toISOString();
      const messageId = "00000000-0000-4000-8000-" + String(Date.now()).padStart(12, "0").slice(-12);

      const newMessage = {
        id: messageId,
        content: validInput.content,
        createdAt: now,
        updatedAt: now,
      };

      if (!record) {
        record = {
          date: validDate,
          recordStatus: "draft",
          summaryStatus: "not_due",
          contentRevision: 1,
          messages: [newMessage],
          summary: null,
          corrections: [],
        };
        store.records.set(validDate, record);
      } else {
        if (record.recordStatus === "confirmed") {
          throw new HealthApiError(API_ERROR_CODES.recordConfirmed, 409, "확정된 기록은 수정할 수 없습니다.");
        }
        record.contentRevision += 1;
        record.messages.push(newMessage);
        markSummaryStale(record);
      }

      return MessageMutationResponseSchema.parse({
        message: newMessage,
        record: {
          date: record.date,
          recordStatus: record.recordStatus,
          summaryStatus: record.summaryStatus,
          contentRevision: record.contentRevision,
        },
      });
    },

    async updateMessage(
      date: LocalDate,
      messageId: string,
      input: UpdateMessageRequest,
    ): Promise<MessageMutationResponse> {
      const validDate = LocalDateSchema.parse(date);
      const validMessageId = UuidSchema.parse(messageId);
      const validInput = UpdateMessageRequestSchema.parse(input);

      const record = store.records.get(validDate);
      if (!record) throw new HealthApiError(API_ERROR_CODES.recordNotFound, 404, "기록을 찾을 수 없습니다.");
      if (record.recordStatus === "confirmed") {
        throw new HealthApiError(API_ERROR_CODES.recordConfirmed, 409, "확정된 기록은 수정할 수 없습니다.");
      }

      const msg = record.messages.find((m) => m.id === validMessageId);
      if (!msg) throw new HealthApiError(API_ERROR_CODES.messageNotFound, 404, "메시지를 찾을 수 없습니다.");

      msg.content = validInput.content;
      msg.updatedAt = new Date().toISOString();
      record.contentRevision += 1;
      if (record.summaryStatus === "ready") {
        record.summaryStatus = "stale";
      }

      return MessageMutationResponseSchema.parse({
        message: msg,
        record: {
          date: record.date,
          recordStatus: record.recordStatus,
          summaryStatus: record.summaryStatus,
          contentRevision: record.contentRevision,
        },
      });
    },

    async deleteMessage(date: LocalDate, messageId: string): Promise<void> {
      const validDate = LocalDateSchema.parse(date);
      const validMessageId = UuidSchema.parse(messageId);

      const record = store.records.get(validDate);
      if (!record) throw new HealthApiError(API_ERROR_CODES.recordNotFound, 404, "기록을 찾을 수 없습니다.");
      if (record.recordStatus === "confirmed") {
        throw new HealthApiError(API_ERROR_CODES.recordConfirmed, 409, "확정된 기록은 수정할 수 없습니다.");
      }

      record.messages = record.messages.filter((m) => m.id !== validMessageId);
      if (record.messages.length === 0) {
        store.records.delete(validDate);
      } else {
        record.contentRevision += 1;
      }
    },

    async getSuggestions(date: LocalDate): Promise<SuggestionsResponse> {
      LocalDateSchema.parse(date);
      return SuggestionsResponseSchema.parse(store.suggestions);
    },

    async retrySummary(date: LocalDate): Promise<RetrySummaryResponse> {
      const validDate = LocalDateSchema.parse(date);

      // 실제 Backend(retry_daily_summary RPC, B7 · API.md 9절)와 같은 순서·같은 code로 거절한다.
      const record = store.records.get(validDate);
      if (!record) throw new HealthApiError(API_ERROR_CODES.recordNotFound, 404, "기록을 찾을 수 없습니다.");
      if (record.recordStatus === "confirmed" || !RETRYABLE_SUMMARY_STATUSES.includes(record.summaryStatus)) {
        throw new HealthApiError(API_ERROR_CODES.summaryNotRetryable, 409, "지금은 다시 정리할 수 없습니다.");
      }

      // 재시도는 원문(content_revision)을 바꾸지 않고 상태만 되돌린다. AI 호출은 스케줄러가 담당한다.
      record.summaryStatus = "pending";
      return RetrySummaryResponseSchema.parse({ summaryStatus: "pending" });
    },

    async updateSummary(date: LocalDate, input: UpdateSummaryRequest): Promise<UpdateSummaryResponse> {
      const validDate = LocalDateSchema.parse(date);
      const validInput = UpdateSummaryRequestSchema.parse(input);

      // 실제 Backend(update_daily_summary RPC, B4/B7)와 같은 순서·같은 code로 거절한다.
      const record = store.records.get(validDate);
      if (!record) throw new HealthApiError(API_ERROR_CODES.recordNotFound, 404, "기록을 찾을 수 없습니다.");
      if (record.recordStatus === "confirmed") {
        throw new HealthApiError(API_ERROR_CODES.recordConfirmed, 409, "확정된 기록은 수정할 수 없습니다.");
      }
      if (record.summaryStatus === "stale") {
        throw new HealthApiError(API_ERROR_CODES.summaryStale, 409, "원문 변경으로 요약이 오래되었습니다. 다시 정리해주세요.");
      }
      if (!record.summary || record.summaryStatus !== "ready") {
        throw new HealthApiError(API_ERROR_CODES.summaryNotReady, 409, "확인할 수 있는 요약이 아직 준비되지 않았습니다.");
      }
      if (record.summary.sourceRevision !== record.contentRevision) {
        throw new HealthApiError(API_ERROR_CODES.summaryStale, 409, "원문 변경으로 요약이 오래되었습니다. 다시 정리해주세요.");
      }

      const updatedSummary = {
        ...record.summary,
        userFinal: validInput,
      };

      record.summary = updatedSummary;
      return UpdateSummaryResponseSchema.parse({ summary: updatedSummary });
    },

    async confirmRecord(date: LocalDate): Promise<ConfirmRecordResponse> {
      const validDate = LocalDateSchema.parse(date);

      // 실제 Backend(confirm_daily_record RPC, B4/B7)와 같은 순서·같은 code로 거절한다.
      const record = store.records.get(validDate);
      if (!record) throw new HealthApiError(API_ERROR_CODES.recordNotFound, 404, "기록을 찾을 수 없습니다.");

      if (record.recordStatus === "confirmed") {
        // 확정은 idempotent: 같은 confirmedAt을 다시 돌려준다.
        const confirmedAt = store.confirmedAt.get(validDate) ?? record.summary?.generatedAt ?? new Date().toISOString();
        store.confirmedAt.set(validDate, confirmedAt);
        return ConfirmRecordResponseSchema.parse({ recordStatus: "confirmed", confirmedAt });
      }

      if (!record.summary) {
        throw new HealthApiError(API_ERROR_CODES.summaryNotReady, 409, "확인할 수 있는 요약이 아직 준비되지 않았습니다.");
      }
      if (record.summaryStatus === "stale" || record.summary.sourceRevision !== record.contentRevision) {
        throw new HealthApiError(API_ERROR_CODES.summaryStale, 409, "원문 변경으로 요약이 오래되었습니다. 다시 정리해주세요.");
      }
      if (record.summaryStatus !== "ready") {
        throw new HealthApiError(API_ERROR_CODES.summaryNotReady, 409, "확인할 수 있는 요약이 아직 준비되지 않았습니다.");
      }

      const confirmedAt = new Date().toISOString();
      record.recordStatus = "confirmed";
      // 확정은 확정 당시의 정리본을 남긴다(userFinal이 없으면 AI 초안을 그대로 확정본으로 둔다).
      record.summary = { ...record.summary, userFinal: record.summary.userFinal ?? record.summary.aiDraft };
      store.confirmedAt.set(validDate, confirmedAt);

      return ConfirmRecordResponseSchema.parse({
        recordStatus: "confirmed",
        confirmedAt,
      });
    },

    async createCorrection(date: LocalDate, input: CreateCorrectionRequest): Promise<CreateCorrectionResponse> {
      const validDate = LocalDateSchema.parse(date);
      const validInput = CreateCorrectionRequestSchema.parse(input);

      const record = store.records.get(validDate);
      if (!record) throw new HealthApiError(API_ERROR_CODES.recordNotFound, 404, "기록을 찾을 수 없습니다.");
      if (record.recordStatus !== "confirmed") {
        throw new HealthApiError(API_ERROR_CODES.recordNotConfirmed, 409, "확정된 기록에만 정정을 추가할 수 있습니다.");
      }

      const correction = {
        id: "00000000-0000-4000-8000-" + String(Date.now()).padStart(12, "0").slice(-12),
        content: validInput.content,
        createdAt: new Date().toISOString(),
      };
      record.corrections.push(correction);

      return CreateCorrectionResponseSchema.parse({ correction });
    },

    async deleteDailyRecord(date: LocalDate): Promise<void> {
      const validDate = LocalDateSchema.parse(date);
      store.records.delete(validDate);
      store.confirmedAt.delete(validDate);
    },

    async getVisitPrep(from: LocalDate, to: LocalDate): Promise<VisitPrepResponse> {
      LocalDateSchema.parse(from);
      LocalDateSchema.parse(to);
      return VisitPrepResponseSchema.parse(store.visitPrep);
    },

    async getProfile(): Promise<ProfileResponse> {
      return ProfileResponseSchema.parse(store.profile);
    },

    async updateProfile(input: UpdateProfileRequest): Promise<ProfileResponse> {
      const { reason, consentVersion, onboardingCompleted } = UpdateProfileRequestSchema.parse(input);
      // 실제 서버와 같은 규칙: 동의 이력은 reason: "consent"로 명시한 요청만 기록한다.
      if (onboardingCompleted !== undefined) {
        store.profile = { ...store.profile, onboardingCompleted };
      }
      if (reason === "consent" && consentVersion !== undefined) {
        if (consentVersion !== CURRENT_CONSENT_VERSION) {
          throw new HealthApiError("VALIDATION_ERROR", 400, "요청을 확인해주세요.");
        }
        store.profile = { ...store.profile, consentVersion };
      }
      return ProfileResponseSchema.parse(store.profile);
    },

    async deleteHealthData(): Promise<void> {
      store.records.clear();
      store.confirmedAt.clear();
    },

    async deleteAccount(): Promise<void> {
      store.records.clear();
      store.confirmedAt.clear();
      store.profile = { onboardingCompleted: false, consentVersion: null };
    },

    async runSummaryWorker(): Promise<void> {
      for (const record of store.records.values()) {
        if (record.recordStatus !== "draft") continue;
        if (!CLAIMABLE_SUMMARY_STATUSES.includes(record.summaryStatus)) continue;
        // 실제 job은 원문이 없는 record를 실패 처리한다. Mock은 원문을 그대로 두지 않고 건너뛴다.
        if (record.messages.length === 0) continue;

        record.summary = {
          sourceRevision: record.contentRevision,
          aiDraft: buildSummaryDraft(record),
          userFinal: null,
          generatedAt: new Date().toISOString(),
        };
        record.summaryStatus = "ready";
      }
    },
  };
}
