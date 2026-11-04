<script setup lang="ts">
defineProps<{text:string|number}>()
</script>
<template><span class="cartoon-text" role="img" :aria-label="String(text)">{{text}}</span></template>
<style scoped>
.cartoon-text{display:block;flex:none;font-family:"Trebuchet MS","Malgun Gothic",sans-serif;font-weight:900;line-height:1.1;white-space:nowrap;color:var(--letter-fill,#ffe9b0);-webkit-text-stroke:.065em var(--letter-outline,#4c2b18);paint-order:stroke fill;text-shadow:0 .065em #a06330,.035em .11em .02em #24150e;font-variant-numeric:tabular-nums;letter-spacing:.035em}
</style>
