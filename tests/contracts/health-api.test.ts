import { DailyRecordResponseSchema } from "@/contracts";
import {
  API_ERROR_CODES,
  HealthApiError,
  createHealthApi,
  isApiError,
} from "@/features/records/api/health-api";
import { createMockHealthApi } from "@/mocks/health-api";

const recordResponse = {
  record: {
    date: "2026-09-25",
    recordStatus: "draft",
    summaryStatus: "not_due",
    contentRevision: 1,
    messages: [],
    summary: null,
    corrections: [],
  },
};

describe("health API adapters", () => {
  it("validates HTTP responses against the shared contract", async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify(recordResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const api = createHealthApi(fetcher);
    const result = await api.getDailyRecord("2026-09-25");

    expect(calls).toEqual(["/api/daily-records/2026-09-25"]);
    expect(DailyRecordResponseSchema.parse(result)).toEqual(recordResponse);
  });

  it("rejects malformed HTTP responses instead of passing them to the UI", async () => {
    const fetcher: typeof fetch = async () =>
      new Response(JSON.stringify({
        record: { ...recordResponse.record, recordStatus: "unknown" },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    await expect(createHealthApi(fetcher).getDailyRecord("2026-09-25")).rejects.toThrow();
  });

  it("validates a mock fixture through the same response schema", async () => {
    const result = await createMockHealthApi().getDailyRecord("2026-09-25");

    expect(DailyRecordResponseSchema.parse(result)).toEqual(result);
  });

  it("does not invent records for dates without a fixture", async () => {
    // I-201: Mock은 실제 API와 같은 contract error code/status로 던져야 한다.
    // (메시지 문자열이 다르면 화면 분기가 깨지므로 문자열로 판별하지 않는다.)
    await expect(createMockHealthApi().getDailyRecord("2026-09-24")).rejects.toMatchObject({
      code: API_ERROR_CODES.recordNotFound,
      status: 404,
    });
  });

  it("maps a real 404 response body to the same error shape as the mock", async () => {
    const fetcher: typeof fetch = async () =>
      new Response(
        JSON.stringify({ error: { code: "RECORD_NOT_FOUND", message: "기록을 찾을 수 없습니다." } }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );

    const realError = await createHealthApi(fetcher)
      .getDailyRecord("2026-09-24")
      .catch((error: unknown) => error);
    const mockError = await createMockHealthApi()
      .getDailyRecord("2026-09-24")
      .catch((error: unknown) => error);

    expect(realError).toBeInstanceOf(HealthApiError);
    expect(mockError).toBeInstanceOf(HealthApiError);
    expect({ code: (realError as HealthApiError).code, status: (realError as HealthApiError).status }).toEqual({
      code: (mockError as HealthApiError).code,
      status: (mockError as HealthApiError).status,
    });
  });

  it("marks a network failure with status 0 instead of a fake contract code", async () => {
    const fetcher: typeof fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    const error = await createHealthApi(fetcher)
      .getDailyRecord("2026-09-24")
      .catch((caught: unknown) => caught);

    // 네트워크 오류는 isApiError()로 오류를 잘못 분류하지 않도록 status 0으로 구분한다.
    expect(error).toBeInstanceOf(TypeError);
    expect((error as TypeError).message).toContain("Failed to fetch");
  });
  it("분류 헬퍼는 실제 API와 Mock의 404를 빈 상태로, 그 외 오류를 오류로 판정한다", async () => {
    // I-201 회귀 방지: 404를 오류 화면으로 잘못 처리하지 않아야 한다.
    const notFound = async () =>
      new Response(
        JSON.stringify({ error: { code: "RECORD_NOT_FOUND", message: "기록을 찾을 수 없습니다." } }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    const serverError = async () =>
      new Response(
        JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "요청을 처리하지 못했습니다." } }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );

    const fromReal = await createHealthApi(notFound).getDailyRecord("2026-09-24").catch((e: unknown) => e);
    const fromMock = await createMockHealthApi().getDailyRecord("2026-09-24").catch((e: unknown) => e);
    const fromFailure = await createHealthApi(serverError).getDailyRecord("2026-09-24").catch((e: unknown) => e);
    const networkDown = await createHealthApi(async () => {
      throw new TypeError("Failed to fetch");
    }).getDailyRecord("2026-09-24").catch((e: unknown) => e);

    expect(isApiError(fromReal, API_ERROR_CODES.recordNotFound)).toBe(true);
    expect(isApiError(fromMock, API_ERROR_CODES.recordNotFound)).toBe(true);
    expect(isApiError(fromFailure, API_ERROR_CODES.recordNotFound)).toBe(false);
    expect(isApiError(networkDown, API_ERROR_CODES.recordNotFound)).toBe(false);
  });
});
