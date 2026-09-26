import { DailyRecordListResponseSchema, VisitPrepResponseSchema } from "@/contracts";

const createServerClientMock = jest.fn();
const requireUserMock = jest.fn();
const getDailyRecordsMock = jest.fn();
const getVisitPrepMock = jest.fn();

jest.mock("@/lib/supabase/server", () => ({ createServerClient: createServerClientMock }));
jest.mock("@/server/auth/require-user", () => ({ requireUser: requireUserMock }));
jest.mock("@/server/daily-records/daily-record-service", () => ({ getDailyRecords: getDailyRecordsMock }));
jest.mock("@/server/daily-records/visit-prep-service", () => ({ getVisitPrep: getVisitPrepMock }));

const USER = "11111111-1111-4111-8111-111111111111";
const RANGE = { from: "2026-09-20", to: "2026-09-25" };

describe("B5 query API routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: USER });
    createServerClientMock.mockResolvedValue({});
    getDailyRecordsMock.mockResolvedValue({ items: [], unreviewedCount: 0 });
    getVisitPrepMock.mockResolvedValue({
      range: RANGE,
      unreviewed: { count: 0, dates: [] },
      confirmedRecords: [],
    });
  });

  it("GET /api/daily-records parses the range and returns its contract", async () => {
    const { GET } = await import("@/app/api/daily-records/route");
    const response = await GET(new Request(`https://health.example/api/daily-records?from=${RANGE.from}&to=${RANGE.to}`));

    expect(response.status).toBe(200);
    expect(DailyRecordListResponseSchema.parse(await response.json())).toEqual({ items: [], unreviewedCount: 0 });
    expect(getDailyRecordsMock).toHaveBeenCalledWith(expect.anything(), USER, RANGE);
  });

  it("GET /api/visit-prep returns confirmed-only contract", async () => {
    const { GET } = await import("@/app/api/visit-prep/route");
    const response = await GET(new Request(`https://health.example/api/visit-prep?from=${RANGE.from}&to=${RANGE.to}`));

    expect(response.status).toBe(200);
    expect(VisitPrepResponseSchema.parse(await response.json())).toEqual({
      range: RANGE,
      unreviewed: { count: 0, dates: [] },
      confirmedRecords: [],
    });
    expect(getVisitPrepMock).toHaveBeenCalledWith(expect.anything(), USER, RANGE);
  });
});
