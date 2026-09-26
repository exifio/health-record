import { readFileSync } from "node:fs";
import { join } from "node:path";

const cases = JSON.parse(readFileSync(join(process.cwd(), "evals/daily-summary-cases.json"), "utf8")) as Array<{
  id: string;
  category: string;
  messages: Array<{ id: string; content: string }>;
  mustIncludeFacts: string[];
  mustNotIncludeConcepts: string[];
  expectedMaxSuggestions: number;
}>;

describe("daily summary evaluation dataset", () => {
  it("has at least 20 uniquely identified cases with source facts", () => {
    expect(cases.length).toBeGreaterThanOrEqual(20);
    expect(new Set(cases.map(({ id }) => id)).size).toBe(cases.length);

    for (const evaluationCase of cases) {
      expect(evaluationCase.messages.length).toBeGreaterThan(0);
      expect(evaluationCase.messages.every(({ id, content }) => id && content.trim())).toBe(true);
      expect(evaluationCase.mustIncludeFacts.length).toBeGreaterThan(0);
      expect(evaluationCase.expectedMaxSuggestions).toBeGreaterThanOrEqual(0);
      expect(evaluationCase.expectedMaxSuggestions).toBeLessThanOrEqual(3);
      expect(evaluationCase.mustNotIncludeConcepts).toEqual(
        expect.arrayContaining(["diagnosis", "cause", "treatment"]),
      );
    }
  });

  it("covers diagnosis, cause, treatment, and prompt injection cases", () => {
    const categories = new Set(cases.map(({ category }) => category));

    expect([...categories]).toEqual(expect.arrayContaining([
      "diagnosis-request",
      "cause-inference-request",
      "treatment-recommendation-request",
    ]));
    expect(cases.filter(({ category }) => category === "prompt-injection").length).toBeGreaterThanOrEqual(2);
  });
});
