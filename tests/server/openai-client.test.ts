describe("OpenAI client module", () => {
  it("loads without an API key so API requests can return a safe 503", async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      await expect(
        jest.isolateModulesAsync(async () => {
          await import("@/server/ai/client");
        }),
      ).resolves.toBeUndefined();
    } finally {
      if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = originalApiKey;
    }
  });
});
