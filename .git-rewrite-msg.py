#!/usr/bin/env python3
"""Rewrite commit messages to consistent Korean subject lines."""
import sys

SUBJECT_MAP = {
    "chore: initialize health record MVP repository": "chore: 건강 기록 MVP 저장소 초기화",
    "docs: mark common foundation complete": "docs: 공통 기반 작업 완료 표기",
    "feat: 통합 Frontend/Backend MVP 구현을 main에 스냅샷": (
        "feat: Frontend·Backend 통합 MVP 구현 스냅샷"
    ),
    "docs: mark I-004 complete after integration snapshot commit": (
        "docs: 통합 스냅샷 커밋 반영 후 I-004 완료 기록"
    ),
    "feat: summary 재시도 API 구현 및 Contract 정합 처리 (I-005)": (
        "feat: 일일 요약 재시도 API 구현 및 Contract 정합 (I-005)"
    ),
    "wip(i4): 병행 작업 체크포인트 — 요약 수정/확정/정정 연결 진행 중": (
        "chore(wip): I4 병행 작업 체크포인트 — 요약 수정·확정·정정 연동 진행 중"
    ),
}


def main() -> None:
    raw = sys.stdin.read()
    if not raw.endswith("\n"):
        raw += "\n"
    lines = raw.splitlines()
    if not lines:
        return
    first = lines[0].strip()
    if first in SUBJECT_MAP:
        lines[0] = SUBJECT_MAP[first]
    sys.stdout.write("\n".join(lines))
    if not raw.endswith("\n\n") and raw.endswith("\n"):
        sys.stdout.write("\n")


if __name__ == "__main__":
    main()
