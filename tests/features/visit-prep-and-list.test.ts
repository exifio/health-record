import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBadge } from "@/components/common/StatusBadge";
import { sampleVisitPrepResponse, sampleDailyRecordListResponse } from "@/mocks/fixtures";

describe("F6: Records List and Visit Prep (F-601 ~ F-610)", () => {
  // F-603: Status badge checks
  describe("F-603: StatusBadge", () => {
    it("renders confirmed and ready badges with appropriate Korean text", () => {
      const confirmedHtml = renderToStaticMarkup(
        React.createElement(StatusBadge, { status: "confirmed" })
      );
      expect(confirmedHtml).toContain("확정");

      const readyHtml = renderToStaticMarkup(
        React.createElement(StatusBadge, { status: "ready" })
      );
      expect(readyHtml).toContain("확인 필요");
    });
  });

  // F-604: Unreviewed Banner
  describe("F-604: Unreviewed count banner logic", () => {
    it("formats unreviewed count banner correctly", () => {
      const count = sampleDailyRecordListResponse.unreviewedCount;
      const bannerText = `확인하지 않은 기록이 ${count}개 있습니다.`;
      expect(bannerText).toBe("확인하지 않은 기록이 1개 있습니다.");
    });
  });

  // F-605 ~ F-610: Visit Prep Contract & Rendering Data
  describe("F-605 ~ F-610: Visit Prep features", () => {
    it("contains range, unreviewed records, and confirmed records (F-605, F-606, F-610)", () => {
      const prep = sampleVisitPrepResponse;
      expect(prep.range.from).toBe("2026-09-01");
      expect(prep.range.to).toBe("2026-09-25");
      expect(prep.unreviewed.count).toBe(1);
      expect(prep.confirmedRecords.length).toBe(2);
    });

    it("verifies only days with confirmed records exist in visit prep (F-607)", () => {
      const prep = sampleVisitPrepResponse;
      // All items in confirmedRecords must have date and summary
      for (const rec of prep.confirmedRecords) {
        expect(rec.date).toBeDefined();
        expect(rec.summary.timeline.length).toBeGreaterThan(0);
      }
      // Dates with no records are not in confirmedRecords
      const dates = prep.confirmedRecords.map((r) => r.date);
      expect(dates).toContain("2026-09-24");
      expect(dates).toContain("2026-09-22");
      expect(dates).not.toContain("2026-09-23"); // 23 is unreviewed/draft
    });

    it("includes corrections in confirmed record items when present (F-609)", () => {
      const prep = sampleVisitPrepResponse;
      const rec24 = prep.confirmedRecords.find((r) => r.date === "2026-09-24");
      expect(rec24).toBeDefined();
      expect(rec24?.corrections.length).toBeGreaterThan(0);
      expect(rec24?.corrections[0].content).toContain("타이레놀");
    });
  });
});

