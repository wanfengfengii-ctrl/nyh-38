<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { EvolutionStatistics, AnnotationType, AnnotationChange } from '@/types';
  import { ANNOTATION_TYPE_LABELS } from '@/types';
  import { evolutionStatistics, pairEvolutionStats, appStore } from '@/lib/store';

  let fullStats = $evolutionStatistics;
  let pairStats = $pairEvolutionStats;
  let isCompareSet = false;
  let activeStats: EvolutionStatistics | null = null;

  const unsubs = [
    evolutionStatistics.subscribe((v) => (fullStats = v)),
    pairEvolutionStats.subscribe((v) => (pairStats = v)),
    appStore.subscribe(($s) => {
      isCompareSet = !!$s.timelineCompareFromId && !!$s.timelineCompareToId;
    }),
  ];
  onDestroy(() => unsubs.forEach((u) => u()));

  $: activeStats = isCompareSet ? pairStats : fullStats;

  function formatYear(year: number): string {
    if (year < 0) return `公元前${Math.abs(year)}年`;
    return `公元${year}年`;
  }

  function getTypeLabel(type: string): string {
    return ANNOTATION_TYPE_LABELS[type as AnnotationType] || type;
  }

  function getTypeIcon(type: AnnotationType): string {
    switch (type) {
      case 'place': return '📍';
      case 'river': return '🌊';
      case 'boundary': return '📐';
      case 'note': return '📝';
    }
  }

  function getChangeLabel(c: AnnotationChange): string {
    switch (c.type) {
      case 'added': return '新增';
      case 'removed': return '消失';
      case 'modified': return '变更';
      default: return '未变';
    }
  }

  function getChangeClass(c: AnnotationChange): string {
    switch (c.type) {
      case 'added': return 'bg-green-100 text-green-700';
      case 'removed': return 'bg-red-100 text-red-700';
      case 'modified': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  }

  function calcBarWidth(val: number, total: number): number {
    if (total === 0) return 0;
    return (val / total) * 100;
  }

  const annotationTypes: AnnotationType[] = ['place', 'river', 'boundary', 'note'];
  const changeTypes = ['all', 'added', 'removed', 'modified', 'unchanged'] as const;
  const changeTypeLabels: Record<typeof changeTypes[number], string> = {
    all: '全部变化',
    added: '新增',
    removed: '消失',
    modified: '变更',
    unchanged: '未变',
  };

  let filterType: 'all' | AnnotationType = 'all';
  let filterChange: typeof changeTypes[number] = 'all';

  $: filteredChanges = (activeStats?.annotationChanges || []).filter((c) => {
    if (filterType !== 'all' && c.annotationType !== filterType) return false;
    if (filterChange !== 'all' && c.type !== filterChange) return false;
    return true;
  });
</script>

<div class="panel h-full flex flex-col">
  <div class="panel-header">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 20V10"></path>
      <path d="M18 20V4"></path>
      <path d="M6 20v-4"></path>
    </svg>
    <span>演变统计</span>
    {#if isCompareSet}
      <span class="tag bg-parchment-600 text-white ml-auto">两版对比</span>
    {:else}
      <span class="tag bg-parchment-300 text-ink-700 ml-auto">全程演变</span>
    {/if}
  </div>

  {#if !activeStats || activeStats.versionsCount < 2}
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="text-center text-ink-500">
        <div class="text-4xl mb-2">📈</div>
        <div class="text-sm">
          {#if isCompareSet && (!pairStats || activeStats.versionsCount < 2)}
            请设置对比起点和终点
          {:else}
            请在时间轴中至少添加 2 个版本
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="flex-1 overflow-y-auto scrollbar-thin">
      <div class="p-3 space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div class="bg-parchment-100 rounded-md p-2.5 text-center">
            <div class="text-xl font-bold text-ink-800">{activeStats.versionsCount}</div>
            <div class="text-xs text-ink-600 mt-0.5">版本数量</div>
          </div>
          <div class="bg-parchment-100 rounded-md p-2.5 text-center">
            <div class="text-xs text-ink-800 font-semibold truncate">
              {formatYear(activeStats.dateRange.start)}
            </div>
            <div class="text-xs text-ink-400">至</div>
            <div class="text-xs text-ink-800 font-semibold truncate">
              {formatYear(activeStats.dateRange.end)}
            </div>
          </div>
        </div>

        <div class="border-t border-parchment-200 pt-3">
          <div class="text-sm font-medium text-ink-700 mb-2">地理要素变化总览</div>
          <div class="grid grid-cols-4 gap-1.5">
            <div class="bg-green-50 rounded p-2 text-center border border-green-200">
              <div class="text-lg font-bold text-green-700">{activeStats.addedCount}</div>
              <div class="text-[10px] text-green-600 mt-0.5">新增</div>
            </div>
            <div class="bg-red-50 rounded p-2 text-center border border-red-200">
              <div class="text-lg font-bold text-red-700">{activeStats.removedCount}</div>
              <div class="text-[10px] text-red-600 mt-0.5">消失</div>
            </div>
            <div class="bg-amber-50 rounded p-2 text-center border border-amber-200">
              <div class="text-lg font-bold text-amber-700">{activeStats.modifiedCount}</div>
              <div class="text-[10px] text-amber-600 mt-0.5">变更</div>
            </div>
            <div class="bg-gray-50 rounded p-2 text-center border border-gray-200">
              <div class="text-lg font-bold text-gray-600">{activeStats.unchangedCount}</div>
              <div class="text-[10px] text-gray-500 mt-0.5">未变</div>
            </div>
          </div>
        </div>

        <div class="border-t border-parchment-200 pt-3">
          <div class="text-sm font-medium text-ink-700 mb-2">按要素类型分类</div>
          <div class="space-y-2">
            {#each annotationTypes as type}
              {@const bt = activeStats.byType[type]}
              {@const total = bt.added + bt.removed + bt.modified + bt.unchanged}
              <div class="bg-parchment-50 rounded-md p-2 border border-parchment-200">
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-1.5">
                    <span class="text-sm">{getTypeIcon(type)}</span>
                    <span class="text-xs font-medium text-ink-700">{getTypeLabel(type)}</span>
                  </div>
                  <span class="text-xs text-ink-500">共 {total} 项</span>
                </div>
                <div class="flex h-4 rounded-full overflow-hidden">
                  <div
                    class="bg-green-500 transition-all duration-300"
                    style="width: {calcBarWidth(bt.added, total)}%"
                    title="新增: {bt.added}"
                  ></div>
                  <div
                    class="bg-red-500 transition-all duration-300"
                    style="width: {calcBarWidth(bt.removed, total)}%"
                    title="消失: {bt.removed}"
                  ></div>
                  <div
                    class="bg-amber-500 transition-all duration-300"
                    style="width: {calcBarWidth(bt.modified, total)}%"
                    title="变更: {bt.modified}"
                  ></div>
                  <div
                    class="bg-gray-400 transition-all duration-300"
                    style="width: {calcBarWidth(bt.unchanged, total)}%"
                    title="未变: {bt.unchanged}"
                  ></div>
                </div>
                <div class="flex justify-between mt-1 text-[10px] text-ink-500">
                  <span class="text-green-600">+{bt.added}</span>
                  <span class="text-red-600">-{bt.removed}</span>
                  <span class="text-amber-600">~{bt.modified}</span>
                  <span class="text-gray-500">{bt.unchanged}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <div class="border-t border-parchment-200 pt-3">
          <div class="text-sm font-medium text-ink-700 mb-2">变更明细</div>
          <div class="flex gap-1 flex-wrap mb-2">
            <button
              class="text-xs px-2 py-1 rounded-md transition-colors"
              class:bg-parchment-600={filterType === 'all'}
              class:text-white={filterType === 'all'}
              class:bg-parchment-100={filterType !== 'all'}
              class:text-ink-600={filterType !== 'all'}
              on:click={() => (filterType = 'all')}
            >
              全部
            </button>
            {#each annotationTypes as t}
              <button
                class="text-xs px-2 py-1 rounded-md transition-colors"
                class:bg-parchment-600={filterType === t}
                class:text-white={filterType === t}
                class:bg-parchment-100={filterType !== t}
                class:text-ink-600={filterType !== t}
                on:click={() => (filterType = t)}
              >
                {getTypeIcon(t)} {getTypeLabel(t)}
              </button>
            {/each}
          </div>
          <div class="flex gap-1 flex-wrap mb-2">
            {#each changeTypes as ct}
              <button
                class="text-xs px-2 py-1 rounded-md transition-colors"
                class:bg-parchment-600={filterChange === ct}
                class:text-white={filterChange === ct}
                class:bg-parchment-100={filterChange !== ct}
                class:text-ink-600={filterChange !== ct}
                on:click={() => (filterChange = ct)}
              >
                {changeTypeLabels[ct]}
              </button>
            {/each}
          </div>

          {#if filteredChanges.length === 0}
            <div class="text-center text-xs text-ink-400 py-4">无符合条件的记录</div>
          {:else}
            <div class="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin pr-1">
              {#each filteredChanges as c, idx (`${c.annotationId}-${c.toVersionId}-${idx}`)}
                <div
                  class="flex items-start gap-2 p-2 rounded-md bg-white border border-parchment-100 text-xs"
                >
                  <span class="text-base leading-none mt-0.5">{getTypeIcon(c.annotationType)}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-medium text-ink-800 truncate">{c.annotationLabel}</span>
                      <span class="tag {getChangeClass(c)} text-[10px]">{getChangeLabel(c)}</span>
                      <span class="text-[10px] text-ink-400">{getTypeLabel(c.annotationType)}</span>
                    </div>
                    {#if c.type === 'modified'}
                      <div class="mt-1 text-[10px] text-ink-500 space-y-0.5">
                        {#if c.fromLabel !== c.toLabel}
                          <div>🏷️ {c.fromLabel} → {c.toLabel}</div>
                        {/if}
                        {#if c.positionChanged}
                          <div>📍 位置发生变化</div>
                        {/if}
                        {#if c.pointsChanged}
                          <div>📏 坐标点发生变化</div>
                        {/if}
                        {#if c.fromDescription !== c.toDescription}
                          <div>📝 描述发生变化</div>
                        {/if}
                        {#if c.fromColor !== c.toColor}
                          <div>🎨 颜色发生变化</div>
                        {/if}
                      </div>
                    {/if}
                    {#if c.fromDescription && (c.type === 'added' || c.type === 'removed')}
                      <div class="mt-1 text-[10px] text-ink-500 line-clamp-2">{c.fromDescription}</div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
