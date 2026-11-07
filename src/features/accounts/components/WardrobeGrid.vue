<template>
  <div class="wardrobe-grid"><slot /></div>
</template>

<style scoped>
.wardrobe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  align-content: start;
  min-width: 0;
  min-height: 0;
  flex: 1;
  gap: var(--s-sm);
  overflow: auto;
}
</style>
