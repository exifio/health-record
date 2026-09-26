import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const API_DIR = path.join(ROOT, "src", "app", "api");

// service role이 정당한 곳: 스케줄러 전용 job과 Supabase Auth Admin API를 쓰는 계정 삭제만 남는다.
const SERVICE_ROLE_ALLOWLIST = [
  path.join("internal", "daily-summary", "run", "route.ts"),
  path.join("account", "route.ts"),
];

function routeFiles(dir = API_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

function migration(name: string): string {
  return readFileSync(path.join(ROOT, "supabase", "migrations", name), "utf8");
}

describe("I-005 사용자 write API 세션 클라이언트 전환", () => {
  it("사용자 요청을 처리하는 route는 service role client를 사용하지 않는다", () => {
    const offenders = routeFiles()
      .filter((file) => !SERVICE_ROLE_ALLOWLIST.includes(path.relative(API_DIR, file)))
      .filter((file) => readFileSync(file, "utf8").includes("@/lib/supabase/admin"))
      .map((file) => path.relative(ROOT, file));

    expect(offenders).toEqual([]);
  });

  it("계정 삭제만 service role을 사용해 Auth 계정까지 지운다", () => {
    const source = readFileSync(path.join(API_DIR, "account", "route.ts"), "utf8");

    expect(source).toContain("@/lib/supabase/admin");
    expect(source).toContain("@/lib/supabase/server");
  });

  it.each([
    "update_daily_summary",
    "confirm_daily_record",
    "create_record_correction",
    "retry_daily_summary",
  ])("%s RPC는 세션에서 호출할 수 있고 auth.uid()를 직접 검증한다", (fn) => {
    const sql = migration("20260926090000_b7_session_client_rpc.sql");

    expect(sql).toContain(`create or replace function public.${fn}(`);
    expect(sql).toMatch(new RegExp(`grant execute on function public\\.${fn}\\([^;]+to authenticated`));
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    // 함수 본문이 auth.uid() 검증을 포함하는지 블록 단위로 확인한다.
    const start = sql.indexOf(`create or replace function public.${fn}(`);
    expect(start).toBeGreaterThanOrEqual(0);
    const body = sql.slice(start, sql.indexOf("$fn$;", start));
    expect(body).toContain("if (select auth.uid()) is distinct from p_user_id then");
    expect(body).toContain("raise exception 'FORBIDDEN'");
  });

  it("스케줄러 전용 RPC는 여전히 service_role에만 허용된다", () => {
    const sql = migration("20260926090000_b7_session_client_rpc.sql");
    const schedulerSql = migration("20260925141633_b3_daily_summaries.sql");

    for (const fn of ["claim_daily_summary", "complete_daily_summary", "fail_daily_summary"]) {
      expect(sql).not.toContain(`to authenticated, service_role;\n-- ${fn}`);
      expect(schedulerSql).toMatch(
        new RegExp(`revoke all on function public\\.${fn}\\([^;]+from public, anon, authenticated`),
      );
    }
  });

  it("사용자 write RPC에 대한 테이블 직접 grant를 새로 열지 않는다", () => {
    const sql = migration("20260926090000_b7_session_client_rpc.sql");

    expect(sql).not.toMatch(/grant (insert|update|delete|all).* on public\./);
  });

  it("기록이 없는 과거 날짜 신규 작성은 DB에서 거절하고 오늘은 허용한다", () => {
    const sql = migration("20260926100000_b8_no_backfill_past_dates.sql");

    expect(sql).toContain("create or replace function public.create_record_message(");
    expect(sql).toContain("raise exception 'RECORD_DATE_NOT_WRITABLE'");
    // 오늘 날짜의 첫 기록은 여전히 record를 생성하고, 과거 날짜만 막는다.
    expect(sql).toMatch(/if not found then[\s\S]*?p_local_date < v_today[\s\S]*?insert into public\.daily_records/);
    // 미래 날짜 거절, 확정 기록 거절, 권한 검증은 유지된다.
    expect(sql).toContain("if p_local_date > v_today then");
    expect(sql).toContain("raise exception 'RECORD_CONFIRMED'");
    expect(sql).toContain("if (select auth.uid()) is distinct from p_user_id then");
  });
});