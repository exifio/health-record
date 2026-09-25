import { DailyRecordResponseSchema, LocalDateSchema } from "@/contracts";
import type { HealthApi } from "@/features/records/api/health-api";
import { sampleDailyRecordResponse } from "@/mocks/fixtures";

export type MockHealthApi = Pick<HealthApi, "getDailyRecord">;

export function createMockHealthApi(): MockHealthApi {
  return {
    async getDailyRecord(date) {
      const requestedDate = LocalDateSchema.parse(date);
      if (requestedDate !== sampleDailyRecordResponse.record.date) {
        throw new Error("기록이 없습니다.");
      }
      return DailyRecordResponseSchema.parse(sampleDailyRecordResponse);
    },
  };
}
