import { isFutureDate, localDateIn } from "@/server/time/timezone";

describe("local_date 계산 (B-113, B-115, B-701, B-702)", () => {
  const seoul = "Asia/Seoul";

  it("23:59는 같은 local_date", () => {
    const at = new Date("2026-09-25T14:59:00.000Z");
    expect(localDateIn(seoul, at)).toBe("2026-09-25");
  });

  it("다음날 00:00은 다음 local_date", () => {
    const at = new Date("2026-09-25T15:00:00.000Z");
    expect(localDateIn(seoul, at)).toBe("2026-09-26");
  });

  it("UTC 기준과 다른 날짜가 될 수 있다", () => {
    const at = new Date("2026-09-25T15:30:00.000Z");
    expect(localDateIn(seoul, at)).toBe("2026-09-26");
    expect(localDateIn("UTC", at)).toBe("2026-09-25");
  });

  it("같은 UTC instant는 timezone마다 다른 local_date를 준다", () => {
    const at = new Date("2026-09-25T02:00:00.000Z");
    expect(localDateIn("America/Los_Angeles", at)).toBe("2026-09-24");
  });
});

describe("isFutureDate", () => {
  it("문자열 비교로 미래/과거/오늘을 판단한다", () => {
    expect(isFutureDate("2026-09-26", "2026-09-25")).toBe(true);
    expect(isFutureDate("2026-09-25", "2026-09-25")).toBe(false);
    expect(isFutureDate("2026-09-24", "2026-09-25")).toBe(false);
  });
});
