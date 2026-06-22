# L4 · API · `useGame()`

> 上层：[L2 UI 层](../L2-components/ui.md) ｜ 源码：`src/composables/useGame.ts`
>
> 把纯引擎接入 Vue 响应式的组合式函数。`App.vue` 调用一次，向各视图分发字段与方法。

## 签名

```typescript
function useGame(initial: Partial<GameConfig> = {}): {
  state, phase, current, round, outcome, config,
  applySecret, applyGuess, reset, checkSecret, checkGuess,
}
```

内部持有 `const state = ref<GameState>(createGame(initial))`，所有方法通过**替换 `state.value` 为引擎返回的新对象**来驱动响应式更新。

## 返回的响应式字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `state` | `Ref<GameState>` | 可读引用（替换式更新）（读 `state.value`）。模板里通过 `state.history` / `state.secrets` 访问。 |
| `phase` | `ComputedRef<Phase>` | `state.value.phase`（`'setup' \| 'playing' \| 'over'`）。 |
| `current` | `ComputedRef<PlayerId>` | `state.value.current`，当前轮到谁猜。 |
| `round` | `ComputedRef<number>` | `state.value.round`，回合数（从 1）。 |
| `outcome` | `ComputedRef<Outcome>` | `state.value.outcome`，结局联合类型。 |
| `config` | `ComputedRef<GameConfig>` | `state.value.config`，含 `digits`。 |

## 方法

| 方法 | 签名 | 作用 |
|------|------|------|
| `applySecret` | `(player: PlayerId, value: string) => void` | `state.value = setSecret(state.value, player, value)` |
| `applyGuess` | `(value: string) => void` | `state.value = submitGuess(state.value, value)` |
| `reset` | `(config?: Partial<GameConfig>) => void` | `state.value = createGame(config)`，重开一局 |
| `checkSecret` | `(value: string) => ValidationResult` | `validateSecret(value, state.value.config)`，绑定当前 config |
| `checkGuess` | `(value: string) => ValidationResult` | `validateGuess(value, state.value.config)`，绑定当前 config |

> `applySecret` / `applyGuess` 直接透传到引擎，引擎的抛错条件（阶段非法、重复设置、非法值）同样适用——但 UI 已用 `checkSecret`/`checkGuess` 禁用非法提交，正常流程不触发。

## 在 `App.vue` 中的接线

```typescript
const {
  phase, current, outcome, config, state,
  applySecret, applyGuess, checkSecret, checkGuess, reset,
} = useGame()
```

```vue
<!-- playing 阶段左右两侧推理助手（红/蓝） -->
<SolverPanel v-if="phase === 'playing'" :digits="config.digits" :guesses="state.history.p1" side="red" />

<SetupView  v-if="phase === 'setup'"        :digits="config.digits" :validate="checkSecret" @set-secret="applySecret" />
<PlayView   v-else-if="phase === 'playing'" :digits="config.digits" :current="current"
                                            :validate="checkGuess" :history="state.history" @guess="applyGuess" />
<ResultView v-else                          :outcome="outcome" :secrets="state.secrets" :history="state.history" @play-again="reset()" />

<SolverPanel v-if="phase === 'playing'" :digits="config.digits" :guesses="state.history.p2" side="blue" />
```

> `useGame` 仍导出 `round`（引擎内部回合计数），但 **playing 阶段已无交接屏，`PlayView` 不再接收 `round`**。
