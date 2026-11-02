<script setup lang="ts">
import { PaintedText } from '../game/art'
defineProps<{text:string|number}>()
</script>
<template><PaintedText :text="text"/></template>
