import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { errorResponse } from "@/server/errors/app-error";

const ROOT = path.resolve(__dirname, "../..");
const PRIVATE_ENV_NAMES = ["SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "CRON_SECRET"];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(ts|tsx|js)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe("B6 server security boundaries", () => {
  it("marks admin and AI clients as server-only and keeps their secrets out of client source", () => {
    for (const file of [
      "src/lib/supabase/admin.ts",
      "src/server/account/account-service.ts",
      "src/server/ai/client.ts",
    ]) {
      expect(readFileSync(path.join(ROOT, file), "utf8")).toMatch(/import ["']server-only["']/);
    }

    const clientSource = ["src/components", "src/features", "src/app"]
      .flatMap((directory) => sourceFiles(path.join(ROOT, directory)))
      .filter((file) => !file.includes(`${path.sep}api${path.sep}`))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    for (const name of PRIVATE_ENV_NAMES) expect(clientSource).not.toContain(name);
  });

  it("does not echo unexpected health-text errors in an API response", async () => {
    const privateText = "synthetic health detail that must stay private";
    const response = errorResponse(new Error(privateText));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(privateText);
  });
});
