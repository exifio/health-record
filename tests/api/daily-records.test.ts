import { DailyRecordResponseSchema, MessageMutationResponseSchema } from "@/contracts";
import { AppError } from "@/server/errors/app-error";

const createServerClientMock = jest.fn();
const requireUserMock = jest.fn();
const getDailyRecordMock = jest.fn();
const createMessageMock = jest.fn();
const updateMessageMock = jest.fn();
const deleteMessageMock = jest.fn();
const createSuggestionsMock = jest.fn();

jest.mock("@/lib/supabase/server", () => ({ createServerClient: createServerClientMock }));
jest.mock("@/server/auth/require-user", () => ({ requireUser: requireUserMock }));
jest.mock("@/server/daily-records/daily-record-service", () => ({
  getDailyRecord: getDailyRecordMock,
  createMessage: createMessageMock,
  updateMessage: updateMessageMock,
  deleteMessage: deleteMessageMock,
}));
jest.mock("@/server/daily-records/suggestion-service", () => ({
  createSuggestions: createSuggestionsMock,
}));

const USER = "11111111-1111-4111-8111-111111111111";
const DATE = "2026-09-25";
const MESSAGE_ID = "22222222-2222-4222-8222-222222222222";

const detailResponse = {
  record: {
    date: DATE,
    recordStatus: "draft",
    summaryStatus: "not_due",
    contentRevision: 1,
    messages: [
      {
        id: MESSAGE_ID,
        content: "오늘 아침 두통",
        createdAt: "2026-09-25T00:20:00Z",
        updatedAt: "2026-09-25T00:20:00Z",
      },
    ],
    summary: null,
    corrections: [],
  },
};

const mutationResponse = {
  message: {
    id: MESSAGE_ID,
    content: "오늘 아침 두통",
    createdAt: "2026-09-25T00:20:00Z",
    updatedAt: "2026-09-25T00:20:00Z",
  },
  record: {
    date: DATE,
    recordStatus: "draft",
    summaryStatus: "not_due",
    contentRevision: 1,
  },
};
let savedMessages: string[] = [];

describe("daily-record routes (B-106, B-107, B-108, B-109)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createServerClientMock.mockResolvedValue({});
    requireUserMock.mockResolvedValue({ id: USER });
    getDailyRecordMock.mockResolvedValue(detailResponse);
    createMessageMock.mockResolvedValue(mutationResponse);
    updateMessageMock.mockResolvedValue(mutationResponse);
    deleteMessageMock.mockResolvedValue(undefined);
    createSuggestionsMock.mockResolvedValue({ suggestions: [] });
    savedMessages = [];
    createMessageMock.mockImplementation((_client, _user, input) => {
      savedMessages.push(input.body.content);
      return Promise.resolve(mutationResponse);
    });
  });

  it("GET returns the documented daily record response", async () => {
    const { GET } = await import("@/app/api/daily-records/[date]/route");
    const response = await GET(new Request(`https://health.example/api/daily-records/${DATE}`), {
      params: Promise.resolve({ date: DATE }),
    });

    expect(response.status).toBe(200);
    expect(DailyRecordResponseSchema.parse(await response.json())).toEqual(detailResponse);
    expect(getDailyRecordMock).toHaveBeenCalledWith(expect.anything(), USER, DATE);
  });

  it("POST parses the body and returns 201", async () => {
    const { POST } = await import("@/app/api/daily-records/[date]/messages/route");
    const request = new Request(`https://health.example/api/daily-records/${DATE}/messages`, {
      method: "POST",
      body: JSON.stringify({ content: "오늘 아침 두통", systemTimeZone: "Asia/Seoul" }),
    });
    const response = await POST(request, { params: Promise.resolve({ date: DATE }) });

    expect(response.status).toBe(201);
    expect(MessageMutationResponseSchema.parse(await response.json())).toEqual(mutationResponse);
    expect(createMessageMock).toHaveBeenCalledWith(expect.anything(), USER, {
      date: DATE,
      body: { content: "오늘 아침 두통", systemTimeZone: "Asia/Seoul" },
    });
  });

  it("PATCH parses the body and returns the mutation response", async () => {
    const { PATCH } = await import("@/app/api/daily-records/[date]/messages/[messageId]/route");
    const request = new Request(`https://health.example/api/daily-records/${DATE}/messages/${MESSAGE_ID}`, {
      method: "PATCH",
      body: JSON.stringify({ content: "수정" }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ date: DATE, messageId: MESSAGE_ID }),
    });

    expect(response.status).toBe(200);
    expect(updateMessageMock).toHaveBeenCalledWith(expect.anything(), USER, {
      date: DATE,
      messageId: MESSAGE_ID,
      body: { content: "수정" },
    });
  });

  it("DELETE returns 204", async () => {
    const { DELETE } = await import("@/app/api/daily-records/[date]/messages/[messageId]/route");
    const response = await DELETE(new Request(`https://health.example/api/daily-records/${DATE}/messages/${MESSAGE_ID}`), {
      params: Promise.resolve({ date: DATE, messageId: MESSAGE_ID }),
    });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(deleteMessageMock).toHaveBeenCalledWith(expect.anything(), USER, {
      date: DATE,
      messageId: MESSAGE_ID,
    });
  });

  it("keeps the saved message when separate suggestion generation fails", async () => {
    const content = "오늘 아침부터 머리가 아팠어요.";
    const { POST: createMessageRoute } = await import("@/app/api/daily-records/[date]/messages/route");
    const messageResponse = await createMessageRoute(
      new Request(`https://health.example/api/daily-records/${DATE}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, systemTimeZone: "Asia/Seoul" }),
      }),
      { params: Promise.resolve({ date: DATE }) },
    );

    expect(messageResponse.status).toBe(201);
    expect(savedMessages).toEqual([content]);

    createSuggestionsMock.mockRejectedValueOnce(
      new AppError("AI_SUGGESTION_FAILED", "AI 제안 생성에 실패했습니다.", 503),
    );
    const { POST: suggestionsRoute } = await import("@/app/api/daily-records/[date]/suggestions/route");
    const suggestionsResponse = await suggestionsRoute(
      new Request(`https://health.example/api/daily-records/${DATE}/suggestions`, { method: "POST" }),
      { params: Promise.resolve({ date: DATE }) },
    );

    expect(suggestionsResponse.status).toBe(503);
    expect(savedMessages).toEqual([content]);
    expect(createMessageMock).toHaveBeenCalledTimes(1);
  });
});
