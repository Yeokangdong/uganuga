<script setup lang="ts">
defineProps<{text:string|number}>()
</script>
<template><span class="cartoon-text" role="img" :aria-label="String(text)">{{text}}</span></template>
<style scoped>
.cartoon-text{display:block;flex:none;font-family:"Trebuchet MS","Malgun Gothic",sans-serif;font-weight:900;line-height:1.15;white-space:nowrap;text-shadow:0 .07em #241b17;font-variant-numeric:tabular-nums;letter-spacing:.025em}
</style>
