<script lang="ts">
  import type { AssemblyScheme } from '@/types';
  import { appStore } from '@/lib/store';
  import MapCanvas from './MapCanvas.svelte';

  export let leftScheme: AssemblyScheme | null = null;
  export let rightScheme: AssemblyScheme | null = null;
  export let schemes: AssemblyScheme[] = [];

  let leftId: string | null = null;
  let rightId: string | null = null;

  $: {
    leftId = leftScheme?.id || null;
    rightId = rightScheme?.id || null;
  }

  function updateSchemes() {
    if (leftId && rightId) {
      appStore.setCompareSchemes(leftId, rightId);
    }
  }

  function exitCompare() {
    appStore.setCompareMode(false);
  }

  const getLeftScheme = () => leftId ? (schemes.find((s) => s.id === leftId) || null) : null;
  const getRightScheme = () => rightId ? (schemes.find((s) => s.id === rightId) || null) : null;
  let displayLeft: ReturnType<typeof getLeftScheme> = null;
  let displayRight: ReturnType<typeof getRightScheme> = null;
  $: {
    displayLeft = getLeftScheme();
    displayRight = getRightScheme();
  }
</script>

<div class="h-full flex flex-col gap-3">
  <div class="flex items-center justify-between px-2">
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-ink-700">左侧：</span>
        <select class="input text-sm w-40" bind:value={leftId} on:change={updateSchemes}>
          {#each schemes as s}
            <option value={s.id}>{s.name}</option>
          {/each}
        </select>
      </div>
      <div class="text-parchment-500 font-bold text-lg">⟷</div>
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-ink-700">右侧：</span>
        <select class="input text-sm w-40" bind:value={rightId} on:change={updateSchemes}>
          {#each schemes as s}
            <option value={s.id}>{s.name}</option>
          {/each}
        </select>
      </div>
    </div>
    <button class="btn btn-secondary text-sm" on:click={exitCompare}>
      ✕ 退出对比
    </button>
  </div>

  <div class="flex-1 flex gap-3 min-h-0">
    <div class="flex-1 min-w-0 flex flex-col gap-2">
      <div class="flex items-center justify-between px-3 py-1.5 bg-parchment-50 rounded-lg border border-parchment-200">
        <span class="text-sm font-semibold text-ink-800">{displayLeft?.name || '方案 A'}</span>
        <span class="text-xs text-ink-500">
          碎片 {displayLeft?.fragments.length || 0} · 批注 {displayLeft?.annotations.length || 0}
        </span>
      </div>
      <div class="flex-1 min-h-0">
        {#if displayLeft}
          <MapCanvas
            scheme={displayLeft}
            selectedFragmentId={null}
            selectedAnnotationId={null}
            activeTool="pan"
            readOnly={true}
          />
        {/if}
      </div>
    </div>

    <div class="w-px bg-parchment-300"></div>

    <div class="flex-1 min-w-0 flex flex-col gap-2">
      <div class="flex items-center justify-between px-3 py-1.5 bg-parchment-50 rounded-lg border border-parchment-200">
        <span class="text-sm font-semibold text-ink-800">{displayRight?.name || '方案 B'}</span>
        <span class="text-xs text-ink-500">
          碎片 {displayRight?.fragments.length || 0} · 批注 {displayRight?.annotations.length || 0}
        </span>
      </div>
      <div class="flex-1 min-h-0">
        {#if displayRight}
          <MapCanvas
            scheme={displayRight}
            selectedFragmentId={null}
            selectedAnnotationId={null}
            activeTool="pan"
            readOnly={true}
          />
        {/if}
      </div>
    </div>
  </div>
</div>
