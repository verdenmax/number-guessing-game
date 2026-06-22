# L4 · API · `validate.ts`

> 上层：[L2 引擎层](../L2-components/engine.md) · [L3 校验](../L3-details/validation.md)
>
> 源码：`src/game/validate.ts`。两个函数都**返回 `ValidationResult`，从不抛错**（面向用户校验，文案用于 UI 提示）。

## 类型

```typescript
type ValidationResult = { ok: true } | { ok: false; error: string }
interface GameConfig { digits: number }
```

## 私有 `checkShape(value, digits) → ValidationResult | null`

内部复用的形状校验（长度 → 字符）。返回 `null` 表示形状合法。

| 检查 | 不通过文案 |
|------|-----------|
| `value.length !== digits` | `请输入 ${digits} 位数字` |
| `!/^[0-9]+$/.test(value)` | `只能输入数字 0-9` |

## `validateSecret(value, config) → ValidationResult`

校验**秘密数**：长度 = N、仅 0-9、**每位互不相同**。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | `string` | 待校验秘密数 |
| `config` | `GameConfig` | 取 `config.digits` 作为 N |
| **返回** | `ValidationResult` | 合法 `{ ok: true }`；否则 `{ ok: false, error }` |

规则（依次）：

1. 长度 ≠ N → `请输入 ${digits} 位数字`
2. 含非 0-9 → `只能输入数字 0-9`
3. 有重复数字（`new Set(value).size !== value.length`）→ `每位数字必须互不相同`
4. 全通过 → `{ ok: true }`

```typescript
validateSecret('1234', { digits: 4 }) // { ok: true }
validateSecret('0891', { digits: 4 }) // { ok: true }（前导 0 合法）
validateSecret('12',   { digits: 4 }) // { ok: false, error: '请输入 4 位数字' }
validateSecret('12a4', { digits: 4 }) // { ok: false, error: '只能输入数字 0-9' }
validateSecret('1224', { digits: 4 }) // { ok: false, error: '每位数字必须互不相同' }
```

## `validateGuess(value, config) → ValidationResult`

校验**猜测**：长度 = N、仅 0-9；**允许重复数字**。

| 参数 | 类型 | 说明 |
|------|------|------|
| `value` | `string` | 待校验猜测 |
| `config` | `GameConfig` | 取 `config.digits` 作为 N |
| **返回** | `ValidationResult` | 合法 `{ ok: true }`；否则 `{ ok: false, error }` |

规则（依次）：

1. 长度 ≠ N → `请输入 ${digits} 位数字`
2. 含非 0-9 → `只能输入数字 0-9`
3. 全通过 → `{ ok: true }`（**不校验唯一性**）

```typescript
validateGuess('0290', { digits: 4 }) // { ok: true }
validateGuess('0011', { digits: 4 }) // { ok: true }（允许重复）
validateGuess('029',  { digits: 4 }) // { ok: false, error: '请输入 4 位数字' }
validateGuess('02x0', { digits: 4 }) // { ok: false, error: '只能输入数字 0-9' }
```
