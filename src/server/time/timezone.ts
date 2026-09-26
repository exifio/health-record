/**
 * 서버는 사용자의 timezone 설정을 저장하지 않는다.
 * 클라이언트가 기기/브라우저에서 감지해 전달한 IANA timezone으로만 판단한다.
 */
export function localDateIn(timeZone: string, at: Date = new Date()): string {
  // en-CA는 YYYY-MM-DD 형식이다.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function isFutureDate(localDate: string, today: string): boolean {
  return localDate > today;
}
