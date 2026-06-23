<script setup lang="ts">
import { onMounted, ref, useId } from 'vue'
defineProps<{ message: string; buttonText?: string }>()
const emit = defineEmits<{ continue: [] }>()
const btn = ref<HTMLButtonElement | null>(null)
const msgId = useId()
onMounted(() => btn.value?.focus())
</script>

<template>
  <div class="handoff">
    <p class="message" :id="msgId">{{ message }}</p>
    <button ref="btn" type="button" :aria-describedby="msgId" @click="emit('continue')">
      {{ buttonText ?? '开始' }}
    </button>
  </div>
</template>
