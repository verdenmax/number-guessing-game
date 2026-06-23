<script setup lang="ts">
import { onMounted, ref } from 'vue'
defineProps<{ message: string; buttonText?: string }>()
const emit = defineEmits<{ continue: [] }>()
const btn = ref<HTMLButtonElement | null>(null)
onMounted(() => btn.value?.focus())
</script>

<template>
  <div class="handoff">
    <p class="message">{{ message }}</p>
    <button ref="btn" type="button" @click="emit('continue')">{{ buttonText ?? '开始' }}</button>
  </div>
</template>
