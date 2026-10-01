import type { Metadata } from "next";
import { ThemeProvider } from "@/features/theme/theme-context";
import { AnalyticsProvider } from "@/features/analytics/analytics-provider";
import { GtmScript } from "@/features/analytics/gtm-script";
import "./globals.css";

/**
 * 데이터 수집은 GTM 태그가 담당한다(SECURITY.md 6절).
 * 컨테이너 ID 는 공개값이라 NEXT_PUBLIC_ 이 붙는다. 값은 저장소에 기록하지 않는다.
 */
const GTM_CONTAINER_ID = process.env.NEXT_PUBLIC_GTM_ID;

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
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID ?? ""}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
            title="GTM"
          />
        </noscript>
        <ThemeProvider>
          <GtmScript containerId={GTM_CONTAINER_ID} />
          <AnalyticsProvider />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
