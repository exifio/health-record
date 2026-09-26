import React from "react";
import { HealthApiProvider } from "@/features/api/api-adapter";
import { AuthProvider } from "@/features/auth/auth-context";
import { getServerSession } from "@/server/auth/session";

/**
 * I-104: 로그인 상태를 서버 세션에서 읽어 클라이언트 Provider에 주입한다.
 * 페이지마다 initialStatus를 하드코딩하지 않기 위한 단일 진입점이다.
 */
export async function AuthenticatedApp({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  return (
    <HealthApiProvider>
      <AuthProvider initialStatus={session.status} initialUser={session.user}>
        {children}
      </AuthProvider>
    </HealthApiProvider>
  );
}