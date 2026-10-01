import type { Metadata } from "next";
import { ThemeProvider } from "@/features/theme/theme-context";
import { AnalyticsProvider } from "@/features/analytics/analytics-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "건강 기록",
  description: "하루의 건강 상태를 기록하고 확인합니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const stored = localStorage.getItem("health-record-theme");
                if (stored === "dark" || (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
                  document.documentElement.setAttribute("data-theme", "dark");
                } else if (stored === "light") {
                  document.documentElement.setAttribute("data-theme", "light");
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <AnalyticsProvider />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
