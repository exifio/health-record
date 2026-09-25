import { z } from "zod";

export const LocalDateSchema = z.iso.date();
export const UuidSchema = z.uuid();
export const UtcTimestampSchema = z.iso.datetime();

export const RecordStatusSchema = z.enum(["draft", "confirmed"]);
export const SummaryStatusSchema = z.enum([
  "not_due",
  "pending",
  "processing",
  "ready",
  "stale",
  "failed",
]);

export const MissingInformationFieldSchema = z.enum([
  "onset_time",
  "duration",
  "severity_user_wording",
  "change_over_day",
  "medication_taken",
  "medication_name",
  "medication_time",
  "post_medication_change",
]);

const NonBlankTextSchema = z.string().refine((value) => value.trim().length > 0, {
  error: "내용을 입력해주세요.",
});

export const SystemTimeZoneSchema = z.string().min(1).refine(
  (timeZone) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
      return true;
    } catch {
      return false;
    }
  },
  { error: "유효한 시스템 시간대가 필요합니다." },
);

export const DailyRecordMessageSchema = z.strictObject({
  id: UuidSchema,
  content: NonBlankTextSchema,
  createdAt: UtcTimestampSchema,
  updatedAt: UtcTimestampSchema,
});

export const TimelineItemSchema = z.strictObject({
  text: NonBlankTextSchema,
  sourceMessageIds: z.array(UuidSchema),
});

export const MedicationItemSchema = z.strictObject({
  name: z.string().nullable(),
  timeText: z.string().nullable(),
  effectText: z.string().nullable(),
  sourceMessageIds: z.array(UuidSchema),
});

export const MissingInformationSchema = z.strictObject({
  field: MissingInformationFieldSchema,
  text: NonBlankTextSchema,
});

export const DailySummaryContentSchema = z.strictObject({
  timeline: z.array(TimelineItemSchema),
  medications: z.array(MedicationItemSchema),
  missingInformation: z.array(MissingInformationSchema).max(3),
});

export const DailySummarySchema = z.strictObject({
  sourceRevision: z.number().int().nonnegative(),
  aiDraft: DailySummaryContentSchema,
  userFinal: DailySummaryContentSchema.nullable(),
  generatedAt: UtcTimestampSchema,
});

export const CorrectionSchema = z.strictObject({
  id: UuidSchema,
  content: NonBlankTextSchema,
  createdAt: UtcTimestampSchema,
});

export const SuggestionSchema = z.strictObject({
  id: UuidSchema,
  field: MissingInformationFieldSchema,
  text: NonBlankTextSchema,
});

export const DailyRecordSchema = z.strictObject({
  date: LocalDateSchema,
  recordStatus: RecordStatusSchema,
  summaryStatus: SummaryStatusSchema,
  contentRevision: z.number().int().nonnegative(),
  messages: z.array(DailyRecordMessageSchema),
  summary: DailySummarySchema.nullable(),
  corrections: z.array(CorrectionSchema),
});

export const DailyRecordResponseSchema = z.strictObject({
  record: DailyRecordSchema,
});

export const DailyRecordListItemSchema = z.strictObject({
  date: LocalDateSchema,
  recordStatus: RecordStatusSchema,
  summaryStatus: SummaryStatusSchema,
  messageCount: z.number().int().nonnegative(),
  confirmedAt: UtcTimestampSchema.nullable(),
});

export const DailyRecordListResponseSchema = z.strictObject({
  items: z.array(DailyRecordListItemSchema),
  unreviewedCount: z.number().int().nonnegative(),
});

export const CreateMessageRequestSchema = z.strictObject({
  content: NonBlankTextSchema,
  systemTimeZone: SystemTimeZoneSchema,
});

export const UpdateMessageRequestSchema = z.strictObject({
  content: NonBlankTextSchema,
});

export const MessageMutationResponseSchema = z.strictObject({
  message: DailyRecordMessageSchema,
  record: z.strictObject({
    date: LocalDateSchema,
    recordStatus: RecordStatusSchema,
    summaryStatus: SummaryStatusSchema,
    contentRevision: z.number().int().nonnegative(),
  }),
});

export const SuggestionsResponseSchema = z.strictObject({
  suggestions: z.array(SuggestionSchema).max(3),
});

export const RetrySummaryResponseSchema = z.strictObject({
  summaryStatus: z.literal("pending"),
});

export const UpdateSummaryRequestSchema = DailySummaryContentSchema;

export const UpdateSummaryResponseSchema = z.strictObject({
  summary: DailySummarySchema,
});

export const ConfirmRecordResponseSchema = z.strictObject({
  recordStatus: z.literal("confirmed"),
  confirmedAt: UtcTimestampSchema,
});

export const CreateCorrectionRequestSchema = z.strictObject({
  content: NonBlankTextSchema,
});

export const CreateCorrectionResponseSchema = z.strictObject({
  correction: CorrectionSchema,
});

export const VisitPrepResponseSchema = z.strictObject({
  range: z.strictObject({ from: LocalDateSchema, to: LocalDateSchema }),
  unreviewed: z.strictObject({
    count: z.number().int().nonnegative(),
    dates: z.array(LocalDateSchema),
  }),
  confirmedRecords: z.array(
    z.strictObject({
      date: LocalDateSchema,
      summary: z.strictObject({ timeline: z.array(TimelineItemSchema) }),
      corrections: z.array(CorrectionSchema),
    }),
  ),
});

export const ProfileResponseSchema = z.strictObject({
  onboardingCompleted: z.boolean(),
});

export const UpdateProfileRequestSchema = ProfileResponseSchema;

export const ApiErrorResponseSchema = z.strictObject({
  error: z.strictObject({ code: z.string().min(1), message: z.string() }),
});

export const SummaryJobResponseSchema = z.strictObject({
  claimed: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export type LocalDate = z.infer<typeof LocalDateSchema>;
export type RecordStatus = z.infer<typeof RecordStatusSchema>;
export type SummaryStatus = z.infer<typeof SummaryStatusSchema>;
export type DailyRecordMessage = z.infer<typeof DailyRecordMessageSchema>;
export type DailySummaryContent = z.infer<typeof DailySummaryContentSchema>;
export type DailySummary = z.infer<typeof DailySummarySchema>;
export type Correction = z.infer<typeof CorrectionSchema>;
export type DailyRecord = z.infer<typeof DailyRecordSchema>;
export type DailyRecordResponse = z.infer<typeof DailyRecordResponseSchema>;
export type DailyRecordListResponse = z.infer<typeof DailyRecordListResponseSchema>;
export type CreateMessageRequest = z.infer<typeof CreateMessageRequestSchema>;
export type UpdateMessageRequest = z.infer<typeof UpdateMessageRequestSchema>;
export type MessageMutationResponse = z.infer<typeof MessageMutationResponseSchema>;
export type SuggestionsResponse = z.infer<typeof SuggestionsResponseSchema>;
export type RetrySummaryResponse = z.infer<typeof RetrySummaryResponseSchema>;
export type UpdateSummaryRequest = z.infer<typeof UpdateSummaryRequestSchema>;
export type UpdateSummaryResponse = z.infer<typeof UpdateSummaryResponseSchema>;
export type ConfirmRecordResponse = z.infer<typeof ConfirmRecordResponseSchema>;
export type CreateCorrectionRequest = z.infer<typeof CreateCorrectionRequestSchema>;
export type CreateCorrectionResponse = z.infer<typeof CreateCorrectionResponseSchema>;
export type VisitPrepResponse = z.infer<typeof VisitPrepResponseSchema>;
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
export type SummaryJobResponse = z.infer<typeof SummaryJobResponseSchema>;
