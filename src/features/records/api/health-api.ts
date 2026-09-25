import {
  ApiErrorResponseSchema,
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
import { z } from "zod";

export interface HealthApi {
  getDailyRecord(date: LocalDate): Promise<DailyRecordResponse>;
  getDailyRecords(from: LocalDate, to: LocalDate): Promise<DailyRecordListResponse>;
  createMessage(date: LocalDate, input: CreateMessageRequest): Promise<MessageMutationResponse>;
  updateMessage(
    date: LocalDate,
    messageId: string,
    input: UpdateMessageRequest,
  ): Promise<MessageMutationResponse>;
  deleteMessage(date: LocalDate, messageId: string): Promise<void>;
  getSuggestions(date: LocalDate): Promise<SuggestionsResponse>;
  retrySummary(date: LocalDate): Promise<RetrySummaryResponse>;
  updateSummary(date: LocalDate, input: UpdateSummaryRequest): Promise<UpdateSummaryResponse>;
  confirmRecord(date: LocalDate): Promise<ConfirmRecordResponse>;
  createCorrection(date: LocalDate, input: CreateCorrectionRequest): Promise<CreateCorrectionResponse>;
  deleteDailyRecord(date: LocalDate): Promise<void>;
  getVisitPrep(from: LocalDate, to: LocalDate): Promise<VisitPrepResponse>;
  getProfile(): Promise<ProfileResponse>;
  updateProfile(input: UpdateProfileRequest): Promise<ProfileResponse>;
  deleteHealthData(): Promise<void>;
  deleteAccount(): Promise<void>;
}

async function throwApiError(response: Response): Promise<never> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(`API request failed (${response.status}).`);
  }

  const error = ApiErrorResponseSchema.safeParse(body);
  if (!error.success) throw new Error(`API request failed (${response.status}).`);
  throw new Error(`${error.data.error.code}: ${error.data.error.message}`);
}

export function createHealthApi(fetcher: typeof fetch = fetch): HealthApi {
  async function requestJson<S extends z.ZodType>(
    path: string,
    schema: S,
    init?: RequestInit,
  ): Promise<z.infer<S>> {
    const response = await fetcher(path, init);
    if (!response.ok) await throwApiError(response);
    if (response.status === 204) throw new Error("Expected a JSON response.");
    return schema.parse(await response.json());
  }

  async function requestNoContent(path: string, init: RequestInit): Promise<void> {
    const response = await fetcher(path, init);
    if (response.status === 204) return;
    if (!response.ok) await throwApiError(response);
    throw new Error("Expected a 204 response.");
  }

  const datePath = (date: LocalDate) => encodeURIComponent(LocalDateSchema.parse(date));
  const jsonBody = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    getDailyRecord: (date) =>
      requestJson(`/api/daily-records/${datePath(date)}`, DailyRecordResponseSchema),
    getDailyRecords: (from, to) => {
      const query = new URLSearchParams({
        from: LocalDateSchema.parse(from),
        to: LocalDateSchema.parse(to),
      });
      return requestJson(`/api/daily-records?${query}`, DailyRecordListResponseSchema);
    },
    createMessage: (date, input) =>
      requestJson(
        `/api/daily-records/${datePath(date)}/messages`,
        MessageMutationResponseSchema,
        jsonBody("POST", CreateMessageRequestSchema.parse(input)),
      ),
    updateMessage: (date, messageId, input) =>
      requestJson(
        `/api/daily-records/${datePath(date)}/messages/${encodeURIComponent(UuidSchema.parse(messageId))}`,
        MessageMutationResponseSchema,
        jsonBody("PATCH", UpdateMessageRequestSchema.parse(input)),
      ),
    deleteMessage: (date, messageId) =>
      requestNoContent(
        `/api/daily-records/${datePath(date)}/messages/${encodeURIComponent(UuidSchema.parse(messageId))}`,
        { method: "DELETE" },
      ),
    getSuggestions: (date) =>
      requestJson(
        `/api/daily-records/${datePath(date)}/suggestions`,
        SuggestionsResponseSchema,
        { method: "POST" },
      ),
    retrySummary: (date) =>
      requestJson(
        `/api/daily-records/${datePath(date)}/summary/retry`,
        RetrySummaryResponseSchema,
        { method: "POST" },
      ),
    updateSummary: (date, input) =>
      requestJson(
        `/api/daily-records/${datePath(date)}/summary`,
        UpdateSummaryResponseSchema,
        jsonBody("PATCH", UpdateSummaryRequestSchema.parse(input)),
      ),
    confirmRecord: (date) =>
      requestJson(
        `/api/daily-records/${datePath(date)}/confirm`,
        ConfirmRecordResponseSchema,
        { method: "POST" },
      ),
    createCorrection: (date, input) =>
      requestJson(
        `/api/daily-records/${datePath(date)}/corrections`,
        CreateCorrectionResponseSchema,
        jsonBody("POST", CreateCorrectionRequestSchema.parse(input)),
      ),
    deleteDailyRecord: (date) =>
      requestNoContent(`/api/daily-records/${datePath(date)}`, { method: "DELETE" }),
    getVisitPrep: (from, to) => {
      const query = new URLSearchParams({
        from: LocalDateSchema.parse(from),
        to: LocalDateSchema.parse(to),
      });
      return requestJson(`/api/visit-prep?${query}`, VisitPrepResponseSchema);
    },
    getProfile: () => requestJson("/api/profile", ProfileResponseSchema),
    updateProfile: (input) =>
      requestJson(
        "/api/profile",
        ProfileResponseSchema,
        jsonBody("PATCH", UpdateProfileRequestSchema.parse(input)),
      ),
    deleteHealthData: () => requestNoContent("/api/health-data", { method: "DELETE" }),
    deleteAccount: () => requestNoContent("/api/account", { method: "DELETE" }),
  };
}
