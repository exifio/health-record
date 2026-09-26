import fs from "node:fs";
import path from "node:path";
import { createHealthApi, type HealthApi } from "@/features/records/api/health-api";

const ROOT = process.cwd();
const DATE = "2026-09-25";
const FROM = "2026-08-27";
const TO = "2026-09-25";
const MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 클라이언트가 실제로 요청하는 (method, path)를 그대로 기록한다. 응답 스키마는 이 테스트의 대상이 아니다. */
async function captureRequests(invoke: (api: HealthApi) => Promise<unknown>) {
  const calls: { method: string; path: string }[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ method: init?.method ?? "GET", path: normalizePath(String(input).split("?")[0]) });
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    await invoke(createHealthApi(fetcher));
  } catch {
    // 응답 본문은 무시하고 요청 경로만 확인한다.
  }

  return calls;
}

/** `:date`/실제 날짜/uuid 세그먼트를 Next.js 동적 라우트 표기로 정규화한다. */
function normalizePath(apiPath: string): string {
  const segments = apiPath.replace(/^\/api\//, "").split("/").map((segment) => {
    if (segment === ":date" || DATE_PATTERN.test(segment)) return "[date]";
    if (segment === ":messageId" || UUID_PATTERN.test(segment)) return "[messageId]";
    return segment;
  });

  return `/api/${segments.join("/")}`;
}

function toRouteFileName(apiPath: string): string {
  const segments = normalizePath(apiPath).replace(/^\/api\//, "").split("/");
  return path.join(ROOT, "src", "app", "api", ...segments, "route.ts");
}

function routeSource(method: string, apiPath: string): string {
  const file = toRouteFileName(apiPath);
  const label = `${method} ${apiPath}`;

  expect({ label, exists: fs.existsSync(file) }).toEqual({ label, exists: true });

  const source = fs.readFileSync(file, "utf8");
  expect({ label, exported: source.includes(`export async function ${method}(`) }).toEqual({
    label,
    exported: true,
  });

  return source;
}

function documentedEndpoints(): { method: string; path: string }[] {
  const api = fs.readFileSync(path.join(ROOT, "docs", "API.md"), "utf8");
  const endpoints: { method: string; path: string }[] = [];
  const pattern = /^### (GET|POST|PATCH|DELETE) `(\/api\/[^`]+)`\s*$/gm;

  for (const match of api.matchAll(pattern)) {
    endpoints.push({ method: match[1], path: match[2].split("?")[0] });
  }

  return endpoints;
}

const clientCalls: { label: string; method: string; path: string }[] = [
  { label: "getDailyRecord", method: "GET", path: "/api/daily-records/[date]" },
  { label: "getDailyRecords", method: "GET", path: "/api/daily-records" },
  { label: "createMessage", method: "POST", path: "/api/daily-records/[date]/messages" },
  { label: "updateMessage", method: "PATCH", path: "/api/daily-records/[date]/messages/[messageId]" },
  { label: "deleteMessage", method: "DELETE", path: "/api/daily-records/[date]/messages/[messageId]" },
  { label: "deleteDailyRecord", method: "DELETE", path: "/api/daily-records/[date]" },
  { label: "getSuggestions", method: "POST", path: "/api/daily-records/[date]/suggestions" },
  { label: "retrySummary", method: "POST", path: "/api/daily-records/[date]/summary/retry" },
  { label: "updateSummary", method: "PATCH", path: "/api/daily-records/[date]/summary" },
  { label: "confirmRecord", method: "POST", path: "/api/daily-records/[date]/confirm" },
  { label: "createCorrection", method: "POST", path: "/api/daily-records/[date]/corrections" },
  { label: "getVisitPrep", method: "GET", path: "/api/visit-prep" },
  { label: "getProfile", method: "GET", path: "/api/profile" },
  { label: "updateProfile", method: "PATCH", path: "/api/profile" },
  { label: "deleteHealthData", method: "DELETE", path: "/api/health-data" },
  { label: "deleteAccount", method: "DELETE", path: "/api/account" },
];

const invocations: { label: string; run: (api: HealthApi) => Promise<unknown> }[] = [
  { label: "getDailyRecord", run: (api) => api.getDailyRecord(DATE) },
  { label: "getDailyRecords", run: (api) => api.getDailyRecords(FROM, TO) },
  { label: "createMessage", run: (api) => api.createMessage(DATE, { content: "오늘 아침 두통", systemTimeZone: "Asia/Seoul" }) },
  { label: "updateMessage", run: (api) => api.updateMessage(DATE, MESSAGE_ID, { content: "오늘 아침 가벼운 두통" }) },
  { label: "deleteMessage", run: (api) => api.deleteMessage(DATE, MESSAGE_ID) },
  { label: "deleteDailyRecord", run: (api) => api.deleteDailyRecord(DATE) },
  { label: "getSuggestions", run: (api) => api.getSuggestions(DATE) },
  { label: "retrySummary", run: (api) => api.retrySummary(DATE) },
  { label: "updateSummary", run: (api) => api.updateSummary(DATE, { timeline: [], medications: [], missingInformation: [] }) },
  { label: "confirmRecord", run: (api) => api.confirmRecord(DATE) },
  { label: "createCorrection", run: (api) => api.createCorrection(DATE, { content: "정정 내용" }) },
  { label: "getVisitPrep", run: (api) => api.getVisitPrep(FROM, TO) },
  { label: "getProfile", run: (api) => api.getProfile() },
  { label: "updateProfile", run: (api) => api.updateProfile({ onboardingCompleted: true }) },
  { label: "deleteHealthData", run: (api) => api.deleteHealthData() },
  { label: "deleteAccount", run: (api) => api.deleteAccount() },
];

describe("API contract ↔ route 구현 대조", () => {
  it("HealthApi의 모든 메서드가 기대한 method/path를 호출한다", async () => {
    for (const invocation of invocations) {
      const expected = clientCalls.find((call) => call.label === invocation.label);
      const [call] = await captureRequests(invocation.run);

      expect({ label: invocation.label, ...call }).toEqual({
        label: invocation.label,
        method: expected?.method,
        path: expected?.path,
      });
    }
  });

  it.each(clientCalls)("클라이언트가 사용하는 $method $path 라우트가 구현돼 있다", (call) => {
    routeSource(call.method, call.path);
  });

  it("docs/API.md에 정의된 모든 endpoint가 구현돼 있다", () => {
    const endpoints = documentedEndpoints();

    expect(endpoints.length).toBeGreaterThan(0);
    for (const endpoint of endpoints) {
      routeSource(endpoint.method, endpoint.path);
    }
  });

  it("구현된 /api route 중 Contract에 정의되지 않은 것이 없다", () => {
    const documented = new Set(
      documentedEndpoints().map((endpoint) => `${endpoint.method} ${toRouteFileName(endpoint.path)}`),
    );
    const routeRoot = path.join(ROOT, "src", "app", "api");
    const files: string[] = [];

    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name === "route.ts") files.push(full);
      }
    };
    walk(routeRoot);

    const undocumented = files.flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      return [...source.matchAll(/export async function (GET|POST|PATCH|DELETE|PUT)\(/g)]
        .map((match) => `${match[1]} ${file}`)
        .filter((entry) => !documented.has(entry));
    });

    expect(undocumented).toEqual([]);
  });
});
