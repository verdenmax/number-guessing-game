// 历史时间紧凑格式：本地时区的 "MM-DD HH:mm"（比 toLocaleString 更简洁、跨组件统一）
export function formatPlayedAt(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
