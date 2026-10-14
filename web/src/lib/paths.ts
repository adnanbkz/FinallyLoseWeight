/** Route of a diary day: "/" for today, "/dia/YYYY-MM-DD" otherwise. */
export function dayPath(date: string, today: string): string {
  return date === today ? '/' : `/dia/${date}`
}
