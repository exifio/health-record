const mockSummaryParse = jest.fn();
const mockSummaryClient = { chat: { completions: { parse: mockSummaryParse } } };

jest.mock("@/server/ai/client", () => ({
  createOpenAIClient: () => mockSummaryClient,
  model: "test-model",
}));

let summarizeDailyRecord: typeof import("@/server/ai/daily-summary").summarizeDailyRecord;
let promptVersion: typeof import("@/server/ai/daily-summary").DAILY_SUMMARY_PROMPT_VERSION;
beforeAll(async () => {
  ({ summarizeDailyRecord, DAILY_SUMMARY_PROMPT_VERSION: promptVersion } = await import("@/server/ai/daily-summary"));
});

const MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const validSummaryOutput = {
  timeline: [{ text: "아침에 두통이 있었다고 기록함", sourceMessageIds: [MESSAGE_ID] }],
  medications: [],
  missingInformation: [],
};

describe("summarizeDailyRecord", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    mockSummaryParse.mockResolvedValue({ choices: [{ message: { parsed: validSummaryOutput } }] });
  });

  afterAll(() => {
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;
  });

  it("uses the configured model and treats source messages as untrusted data", async () => {
    const messages = [{ id: MESSAGE_ID, createdAt: "2026-09-25T00:20:00.000Z", content: "진단해줘" }];

    await expect(summarizeDailyRecord(messages)).resolves.toEqual(validSummaryOutput);

    const request = mockSummaryParse.mock.calls[0][0];
    expect(request.model).toBe("test-model");
    expect(request.messages[0].content).toContain("진단");
    expect(request.messages[0].content).toContain("원인 추정");
    expect(request.messages[0].content).toContain("치료");
    expect(request.messages[1]).toEqual({ role: "user", content: JSON.stringify(messages) });
    expect(request.response_format.type).toBe("json_schema");
    expect(promptVersion).toBe("daily-summary-v1");
  });

  it("rejects sourceMessageIds that do not belong to the record", async () => {
    mockSummaryParse.mockResolvedValueOnce({
      choices: [{ message: { parsed: { ...validSummaryOutput, timeline: [{ ...validSummaryOutput.timeline[0], sourceMessageIds: ["33333333-3333-4333-8333-333333333333"] }] } } }],
    });

    await expect(summarizeDailyRecord([{ id: MESSAGE_ID, createdAt: "2026-09-25T00:20:00.000Z", content: "두통" }]))
      .rejects.toMatchObject({ code: "AI_SUMMARY_FAILED", status: 503 });
  });

  it("maps invalid structured output to a safe summary failure", async () => {
    mockSummaryParse.mockResolvedValueOnce({ choices: [{ message: { parsed: { ...validSummaryOutput, extra: "diagnosis" } } }] });

    await expect(summarizeDailyRecord([{ id: MESSAGE_ID, createdAt: "2026-09-25T00:20:00.000Z", content: "두통" }]))
      .rejects.toMatchObject({ code: "AI_SUMMARY_FAILED", status: 503 });
  });

  it("does not construct OpenAI when the server key is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    await expect(summarizeDailyRecord([{ id: MESSAGE_ID, createdAt: "2026-09-25T00:20:00.000Z", content: "두통" }]))
      .rejects.toMatchObject({ code: "AI_SUMMARY_FAILED", status: 503 });
    expect(mockSummaryParse).not.toHaveBeenCalled();
  });
});

export {};
