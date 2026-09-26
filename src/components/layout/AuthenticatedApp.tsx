import React from "react";
import { AuthProvider } from "@/features/auth/auth-context";
import { AuthAwareHealthApiProvider } from "@/components/layout/AuthAwareHealthApiProvider";
import { getServerSession } from "@/server/auth/session";

/**
 * I-104: 로그인 상태를 서버 세션에서 읽어 클라이언트 Provider에 주입한다.
 * 페이지마다 initialStatus를 하드코딩하지 않기 위한 단일 진입점이다.
 *
 * 사용할 API가 로그인 상태에 따라 달라지므로(F-106 / I-106) AuthProvider가 바깥이고,
 * 그 안에서 로그인 상태를 읽어 실제 API 또는 정적 샘플 API를 주입한다.
 */
export async function AuthenticatedApp({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  return (
    <AuthProvider initialStatus={session.status} initialUser={session.user}>
      <AuthAwareHealthApiProvider>{children}</AuthAwareHealthApiProvider>
    </AuthProvider>
  );
}