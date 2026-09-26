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
  type LocalDate,
  type MessageMutationResponse,
  type ProfileResponse,
  type RetrySummaryResponse,
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

export type MockHealthApi = HealthApi;

interface MockStore {
  records: Map<LocalDate, DailyRecordResponse["record"]>;
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
    profile: JSON.parse(JSON.stringify(sampleProfileResponse)),
    suggestions: JSON.parse(JSON.stringify(sampleSuggestionsResponse)),
    visitPrep: JSON.parse(JSON.stringify(sampleVisitPrepResponse)),
  };
}

export function createMockHealthApi(customStore?: Partial<MockStore>): HealthApi {
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

      const record = store.records.get(validDate);
      if (!record) throw new HealthApiError(API_ERROR_CODES.recordNotFound, 404, "기록을 찾을 수 없습니다.");
      if (record.recordStatus === "confirmed") {
        throw new HealthApiError(API_ERROR_CODES.recordConfirmed, 409, "확정된 기록은 수정할 수 없습니다.");
      }

      const now = new Date().toISOString();
      const updatedSummary = {
        sourceRevision: record.contentRevision,
        aiDraft: record.summary?.aiDraft ?? {
          timeline: [],
          medications: [],
          missingInformation: [],
        },
        userFinal: validInput,
        generatedAt: record.summary?.generatedAt ?? now,
      };

      record.summary = updatedSummary;
      return UpdateSummaryResponseSchema.parse({ summary: updatedSummary });
    },

    async confirmRecord(date: LocalDate): Promise<ConfirmRecordResponse> {
      const validDate = LocalDateSchema.parse(date);
      const record = store.records.get(validDate);
      if (!record) throw new HealthApiError(API_ERROR_CODES.recordNotFound, 404, "기록을 찾을 수 없습니다.");
      if (record.summaryStatus === "stale") {
        throw new HealthApiError("SUMMARY_NOT_READY", 409, "확인할 수 있는 요약이 아직 준비되지 않았습니다.");
      }

      const confirmedAt = new Date().toISOString();
      record.recordStatus = "confirmed";
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
    },

    async deleteAccount(): Promise<void> {
      store.records.clear();
      store.profile = { onboardingCompleted: false };
    },
  };
}
