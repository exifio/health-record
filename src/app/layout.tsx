import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "건강 기록",
  description: "하루의 건강 상태를 기록하고 확인합니다.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
