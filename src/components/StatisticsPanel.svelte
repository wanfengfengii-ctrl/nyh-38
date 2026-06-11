<script lang="ts">
  import type { Statistics, AnnotationType } from '@/types';
  import { ANNOTATION_TYPE_LABELS } from '@/types';

  export let stats: Statistics;

  function formatArea(area: number): string {
    if (area < 10000) return `${area.toFixed(0)} px²`;
    if (area < 1000000) return `${(area / 1000).toFixed(1)} K px²`;
    return `${(area / 1000000).toFixed(2)} M px²`;
  }

  function getTypeLabel(type: string): string {
    return ANNOTATION_TYPE_LABELS[type as AnnotationType] || type;
  }
</script>

<div class="panel">
  <div class="panel-header">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="20" x2="18" y2="10"></line>
      <line x1="12" y1="20" x2="12" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="14"></line>
    </svg>
    <span>统计数据</span>
  </div>
  <div class="panel-body space-y-4">
    <div>
      <div class="flex justify-between items-center mb-1">
        <span class="text-sm text-ink-700">拼接完成度</span>
        <span class="text-sm font-semibold text-parchment-700">{stats.assembledPercentage.toFixed(1)}%</span>
      </div>
      <div class="w-full h-3 bg-parchment-200 rounded-full overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-parchment-500 to-parchment-700 rounded-full transition-all duration-300"
          style="width: {Math.min(100, stats.assembledPercentage)}%"
        ></div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="bg-parchment-100 rounded-md p-3 text-center">
        <div class="text-2xl font-bold text-ink-800">{stats.totalFragments}</div>
        <div class="text-xs text-ink-600 mt-0.5">碎片总数</div>
      </div>
      <div class="bg-parchment-100 rounded-md p-3 text-center">
        <div class="text-2xl font-bold text-ink-800">{stats.visibleFragments}</div>
        <div class="text-xs text-ink-600 mt-0.5">可见碎片</div>
      </div>
      <div class="bg-green-50 rounded-md p-3 text-center">
        <div class="text-2xl font-bold text-green-700">{stats.matchedFragments}</div>
        <div class="text-xs text-green-600 mt-0.5">已拼接</div>
      </div>
      <div class="bg-orange-50 rounded-md p-3 text-center">
        <div class="text-2xl font-bold text-orange-700">{stats.unmatchedFragments}</div>
        <div class="text-xs text-orange-600 mt-0.5">未匹配</div>
      </div>
    </div>

    <div class="border-t border-parchment-200 pt-3 space-y-2">
      <div class="flex justify-between items-center text-sm">
        <span class="text-ink-600">已拼接面积</span>
        <span class="font-medium text-green-700">{formatArea(stats.assembledArea)}</span>
      </div>
      <div class="flex justify-between items-center text-sm">
        <span class="text-ink-600">可见总面积</span>
        <span class="font-medium text-ink-800">{formatArea(stats.totalArea)}</span>
      </div>
    </div>

    <div class="border-t border-parchment-200 pt-3">
      <div class="text-sm font-medium text-ink-700 mb-2">
        批注总数: <span class="text-parchment-700">{stats.annotationCount}</span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        {#each Object.entries(stats.annotationByType) as [type, count]}
          <div class="flex items-center justify-between text-xs bg-parchment-100 rounded px-2 py-1.5">
            <span class="text-ink-600">{getTypeLabel(type)}</span>
            <span class="font-semibold text-ink-800">{count}</span>
          </div>
        {/each}
      </div>
    </div>
  </div>
</div>
