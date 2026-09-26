import {
  ConfirmRecordResponseSchema,
  CreateCorrectionResponseSchema,
  UpdateSummaryResponseSchema,
} from "@/contracts";
import { AppError } from "@/server/errors/app-error";

const createAdminClientMock = jest.fn();
const requireUserMock = jest.fn();
const updateDailySummaryMock = jest.fn();
const confirmDailyRecordMock = jest.fn();
const createCorrectionMock = jest.fn();

jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: createAdminClientMock }));
jest.mock("@/server/auth/require-user", () => ({ requireUser: requireUserMock }));
jest.mock("@/server/daily-records/daily-record-service", () => ({
  updateDailySummary: updateDailySummaryMock,
  confirmDailyRecord: confirmDailyRecordMock,
  createCorrection: createCorrectionMock,
}));

const USER = "11111111-1111-4111-8111-111111111111";
const DATE = "2026-09-25";
const SUMMARY = {
  timeline: [],
  medications: [],
  missingInformation: [],
};

describe("B4 daily record endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: USER });
    createAdminClientMock.mockReturnValue({});
    updateDailySummaryMock.mockResolvedValue({
      summary: {
        sourceRevision: 1,
        aiDraft: SUMMARY,
        userFinal: SUMMARY,
        generatedAt: "2026-09-25T15:10:00Z",
      },
    });
    confirmDailyRecordMock.mockResolvedValue({
      recordStatus: "confirmed",
      confirmedAt: "2026-09-26T02:00:00Z",
    });
    createCorrectionMock.mockResolvedValue({
      correction: {
        id: "22222222-2222-4222-8222-222222222222",
        content: "정정 내용",
        createdAt: "2026-09-26T02:00:00Z",
      },
    });
  });

  it("PATCH validates and returns the documented summary", async () => {
    const { PATCH } = await import("@/app/api/daily-records/[date]/summary/route");
    const response = await PATCH(new Request(`https://health.example/api/daily-records/${DATE}/summary`, {
      method: "PATCH",
      body: JSON.stringify(SUMMARY),
    }), { params: Promise.resolve({ date: DATE }) });

    expect(response.status).toBe(200);
    expect(UpdateSummaryResponseSchema.parse(await response.json())).toEqual({
      summary: {
        sourceRevision: 1,
        aiDraft: SUMMARY,
        userFinal: SUMMARY,
        generatedAt: "2026-09-25T15:10:00Z",
      },
    });
    expect(updateDailySummaryMock).toHaveBeenCalledWith(expect.anything(), USER, { date: DATE, body: SUMMARY });
  });

  it("PATCH rejects uncontracted user_id input before creating a service-role client", async () => {
    const { PATCH } = await import("@/app/api/daily-records/[date]/summary/route");
    const response = await PATCH(new Request(`https://health.example/api/daily-records/${DATE}/summary`, {
      method: "PATCH",
      body: JSON.stringify({ ...SUMMARY, user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
    }), { params: Promise.resolve({ date: DATE }) });

    expect(response.status).toBe(400);
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(updateDailySummaryMock).not.toHaveBeenCalled();
  });

  it("POST confirms the record using the verified session user", async () => {
    const { POST } = await import("@/app/api/daily-records/[date]/confirm/route");
    const response = await POST(new Request(`https://health.example/api/daily-records/${DATE}/confirm`, {
      method: "POST",
    }), { params: Promise.resolve({ date: DATE }) });

    expect(response.status).toBe(200);
    expect(ConfirmRecordResponseSchema.parse(await response.json())).toEqual({
      recordStatus: "confirmed",
      confirmedAt: "2026-09-26T02:00:00Z",
    });
    expect(confirmDailyRecordMock).toHaveBeenCalledWith(expect.anything(), USER, DATE);
  });

  it("POST appends a correction and returns 201", async () => {
    const { POST } = await import("@/app/api/daily-records/[date]/corrections/route");
    const response = await POST(new Request(`https://health.example/api/daily-records/${DATE}/corrections`, {
      method: "POST",
      body: JSON.stringify({ content: "정정 내용" }),
    }), { params: Promise.resolve({ date: DATE }) });

    expect(response.status).toBe(201);
    expect(CreateCorrectionResponseSchema.parse(await response.json())).toEqual({
      correction: {
        id: "22222222-2222-4222-8222-222222222222",
        content: "정정 내용",
        createdAt: "2026-09-26T02:00:00Z",
      },
    });
    expect(createCorrectionMock).toHaveBeenCalledWith(expect.anything(), USER, {
      date: DATE,
      body: { content: "정정 내용" },
    });
  });

  it("세션 인증 실패면 service role client나 mutation service를 호출하지 않는다", async () => {
    requireUserMock.mockRejectedValueOnce(new AppError("UNAUTHENTICATED", "로그인이 필요합니다.", 401));
    const { POST } = await import("@/app/api/daily-records/[date]/confirm/route");
    const response = await POST(new Request(`https://health.example/api/daily-records/${DATE}/confirm`, {
      method: "POST",
    }), { params: Promise.resolve({ date: DATE }) });

    expect(response.status).toBe(401);
    expect(createAdminClientMock).not.toHaveBeenCalled();
    expect(confirmDailyRecordMock).not.toHaveBeenCalled();
  });
});
