import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export type SessionStatus = "authenticated" | "unauthenticated";

export interface ServerSession {
  status: SessionStatus;
  user: { id: string; email: string; name?: string } | null;
}

/**
 * I-104: 로그인 상태는 서버 세션으로만 결정한다.
 * 클라이언트가 전달한 값으로 권한을 판단하지 않는다(AGENTS.md 7절).
 *
 * 세션 확인에 실패하면 인증되지 않은 것으로 취급한다. 데모 모드는 서버 세션과
 * 별개로 클라이언트에서만 유지되는 읽기 전용 상태다.
 */
export async function getServerSession(): Promise<ServerSession> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.auth.getUser();

    // requireUser와 동일하게 익명 세션은 인증으로 보지 않는다.
    if (error || !data.user || data.user.is_anonymous) {
      return { status: "unauthenticated", user: null };
    }

    const metadata = data.user.user_metadata ?? {};
    const name =
      typeof metadata.full_name === "string"
        ? metadata.full_name
        : typeof metadata.name === "string"
          ? metadata.name
          : undefined;

    return {
      status: "authenticated",
      user: {
        id: data.user.id,
        email: data.user.email ?? "",
        ...(name ? { name } : {}),
      },
    };
  } catch {
    // 환경변수 미설정 등 서버 오류도 인증되지 않은 상태로 내려보낸다.
    return { status: "unauthenticated", user: null };
  }
}