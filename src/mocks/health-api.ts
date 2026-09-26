import { API_ERROR_CODES, HealthApiError } from "@/features/records/api/health-api";
import {
  ConfirmRecordResponseSchema,
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
  sampleDailyRecordResponse,
  sampleProfileResponse,
  sampleSuggestionsResponse,
  sampleVisitPrepResponse,
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
  const parsed = DailyRecordResponseSchema.parse(sampleDailyRecordResponse);
  records.set(parsed.record.date, JSON.parse(JSON.stringify(parsed.record)));

  return {
    records,
    confirmedAt: new Map<LocalDate, string>(),
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
      LocalDateSchema.parse(from);
      LocalDateSchema.parse(to);
      return DailyRecordListResponseSchema.parse(sampleDailyRecordListResponse);
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
      const record = store.records.get(validDate);
      if (record) {
        record.summaryStatus = "pending";
      }
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
      const validInput = UpdateProfileRequestSchema.parse(input);
      store.profile = { ...store.profile, ...validInput };
      return ProfileResponseSchema.parse(store.profile);
    },

    async deleteHealthData(): Promise<void> {
      store.records.clear();
      store.confirmedAt.clear();
    },

    async deleteAccount(): Promise<void> {
      store.records.clear();
      store.confirmedAt.clear();
      store.profile = { onboardingCompleted: false };
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
