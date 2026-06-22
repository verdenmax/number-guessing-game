<script setup lang="ts">
defineProps<{ message: string; buttonText?: string }>()
const emit = defineEmits<{ continue: [] }>()
</script>

<template>
  <div class="handoff">
    <p class="message">{{ message }}</p>
    <button type="button" @click="emit('continue')">{{ buttonText ?? '开始' }}</button>
  </div>
</template>
