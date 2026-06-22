import type { GameConfig, ValidationResult } from './types'

function checkShape(value: string, digits: number): ValidationResult | null {
  if (value.length !== digits) {
    return { ok: false, error: `请输入 ${digits} 位数字` }
  }
  if (!/^[0-9]+$/.test(value)) {
    return { ok: false, error: '只能输入数字 0-9' }
  }
  return null
}

export function validateSecret(value: string, config: GameConfig): ValidationResult {
  const shape = checkShape(value, config.digits)
  if (shape) return shape
  if (new Set(value).size !== value.length) {
    return { ok: false, error: '每位数字必须互不相同' }
  }
  return { ok: true }
}

export function validateGuess(value: string, config: GameConfig): ValidationResult {
  const shape = checkShape(value, config.digits)
  if (shape) return shape
  return { ok: true }
}
