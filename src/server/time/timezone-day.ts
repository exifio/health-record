export function hasLocalDayEnded(localDate: string, today: string): boolean {
  return today > localDate;
}
