// 历史时间紧凑格式：本地时区 "MM-DD HH:mm"（同年省略年份；跨年补 "YYYY-"），比 toLocaleString 简洁
export function formatPlayedAt(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  const md = `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  // 同年省略年份保持紧凑；跨年则补上年份，避免不同年的同月日混淆
  return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}-${md}`
}
