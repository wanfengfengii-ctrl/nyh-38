<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { ToolType } from '@/types';
  import { appStore } from '@/lib/store';
  let activeTool: ToolType = 'select';
  let isCompareMode = false;
  const unsubscribe = appStore.subscribe(($s) => {
    activeTool = $s.activeTool;
    isCompareMode = $s.isCompareMode;
  });
  const tools: { id: ToolType; label: string; icon: string }[] = [
    { id: 'select', label: '选择/变换', icon: '↔' },
    { id: 'pan', label: '平移画布', icon: '✋' },
    { id: 'annotate-place', label: '标注地名', icon: '📍' },
    { id: 'annotate-river', label: '绘制河道', icon: '🌊' },
    { id: 'annotate-boundary', label: '绘制边界', icon: '📐' },
    { id: 'annotate-note', label: '添加注释', icon: '📝' },
  ];
  function setTool(t: ToolType) {
    appStore.setActiveTool(t);
  }
  function toggleCompare() {
    appStore.setCompareMode(!isCompareMode);
  }
  onDestroy(() => unsubscribe());
</script>

<div class="flex items-center gap-1 p-1 bg-parchment-50 rounded-lg border border-parchment-200 shadow-sm">
  {#each tools as tool}
    <button
      title={tool.label}
      class="relative px-3 py-2 rounded-md text-sm transition-all duration-150"
      class:bg-parchment-600={activeTool === tool.id}
      class:text-white={activeTool === tool.id}
      class:hover:bg-parchment-200={activeTool !== tool.id}
      class:text-ink-700={activeTool !== tool.id}
      on:click={() => setTool(tool.id)}
    >
      <span class="text-base mr-1">{tool.icon}</span>
      <span class="text-xs">{tool.label}</span>
    </button>
  {/each}
  <div class="w-px h-8 bg-parchment-300 mx-1"></div>
  <button
    title="方案对比"
    class="px-3 py-2 rounded-md text-sm transition-all duration-150"
    class:bg-parchment-600={isCompareMode}
    class:text-white={isCompareMode}
    class:hover:bg-parchment-200={!isCompareMode}
    class:text-ink-700={!isCompareMode}
    on:click={toggleCompare}
  >
    <span class="text-base mr-1">⚖️</span>
    <span class="text-xs">方案对比</span>
  </button>
</div>
