<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { MapVersion, AnnotationChangeType } from '@/types';
  import { ANNOTATION_TYPE_LABELS } from '@/types';
  import {
    appStore,
    currentTimeline,
    currentTimelineVersions,
    selectedTimelineVersion,
    selectedTimelineScheme,
    timelineCompareFromVersion,
    timelineCompareToVersion,
    timelineCompareFromScheme,
    timelineCompareToScheme,
    pairEvolutionStats,
  } from '@/lib/store';
  import MapCanvas from './MapCanvas.svelte';

  let curTimeline = $currentTimeline;
  let versions = $currentTimelineVersions;
  let selectedVersion = $selectedTimelineVersion;
  let selectedScheme = $selectedTimelineScheme;
  let fromVersion = $timelineCompareFromVersion;
  let toVersion = $timelineCompareToVersion;
  let fromScheme = $timelineCompareFromScheme;
  let toScheme = $timelineCompareToScheme;
  let pairStats = $pairEvolutionStats;
  let isCompareMode = $appStore.isTimelineMode && !!fromVersion && !!toVersion;

  const unsubs = [
    currentTimeline.subscribe((v) => (curTimeline = v)),
    currentTimelineVersions.subscribe((v) => (versions = v)),
    selectedTimelineVersion.subscribe((v) => (selectedVersion = v)),
    selectedTimelineScheme.subscribe((v) => (selectedScheme = v)),
    timelineCompareFromVersion.subscribe((v) => (fromVersion = v)),
    timelineCompareToVersion.subscribe((v) => (toVersion = v)),
    timelineCompareFromScheme.subscribe((v) => (fromScheme = v)),
    timelineCompareToScheme.subscribe((v) => (toScheme = v)),
    pairEvolutionStats.subscribe((v) => (pairStats = v)),
    appStore.subscribe(($s) => {
      isCompareMode = $s.isTimelineMode && !!$s.timelineCompareFromId && !!$s.timelineCompareToId;
    }),
  ];
  onDestroy(() => unsubs.forEach((u) => u()));

  let syncViewport = true;
  let leftViewportScale = 1;
  let leftViewportX = 0;
  let leftViewportY = 0;
  let rightViewportScale = 1;
  let rightViewportX = 0;
  let rightViewportY = 0;
  let isLeftChanging = false;
  let isRightChanging = false;

  $: {
    if (selectedScheme?.viewport) {
      leftViewportScale = selectedScheme.viewport.scale;
      leftViewportX = selectedScheme.viewport.x;
      leftViewportY = selectedScheme.viewport.y;
    }
  }

  function exitTimeline() {
    appStore.setTimelineMode(false);
  }

  function clearCompare() {
    appStore.setTimelineCompare(null, null);
  }

  function handleLeftViewportChange(e: { detail: { scale: number; x: number; y: number } }) {
    if (!syncViewport || isRightChanging) return;
    isLeftChanging = true;
    const { scale, x, y } = e.detail;
    leftViewportScale = scale;
    leftViewportX = x;
    leftViewportY = y;
    if (isCompareMode) {
      rightViewportScale = scale;
      rightViewportX = x;
      rightViewportY = y;
    }
    requestAnimationFrame(() => {
      isLeftChanging = false;
    });
  }

  function handleRightViewportChange(e: { detail: { scale: number; x: number; y: number } }) {
    if (!syncViewport || isLeftChanging) return;
    isRightChanging = true;
    const { scale, x, y } = e.detail;
    rightViewportScale = scale;
    rightViewportX = x;
    rightViewportY = y;
    requestAnimationFrame(() => {
      isRightChanging = false;
    });
  }

  function prevVersion() {
    if (!selectedVersion) return;
    const idx = versions.findIndex((v) => v.id === selectedVersion.id);
    if (idx > 0) {
      appStore.selectTimelineVersion(versions[idx - 1].id);
    }
  }

  function nextVersion() {
    if (!selectedVersion) return;
    const idx = versions.findIndex((v) => v.id === selectedVersion.id);
    if (idx < versions.length - 1) {
      appStore.selectTimelineVersion(versions[idx + 1].id);
    }
  }

  function formatVersionLabel(v: MapVersion): string {
    return `${v.dynasty} · ${v.year}`;
  }

  function getTimelinePosition(v: MapVersion): number {
    if (versions.length <= 1) return 50;
    const sorted = [...versions].sort((a, b) => a.yearNumeric - b.yearNumeric);
    const min = sorted[0].yearNumeric;
    const max = sorted[sorted.length - 1].yearNumeric;
    if (max === min) return 50;
    return ((v.yearNumeric - min) / (max - min)) * 100;
  }

  function getChangeBadge(type: AnnotationChangeType) {
    switch (type) {
      case 'added': return { cls: 'bg-green-100 text-green-700', label: '新增' };
      case 'removed': return { cls: 'bg-red-100 text-red-700', label: '消失' };
      case 'modified': return { cls: 'bg-amber-100 text-amber-700', label: '变更' };
      default: return { cls: 'bg-gray-100 text-gray-600', label: '未变' };
    }
  }

  function getChangeIcon(type: Annotation['type']): string {
    switch (type) {
      case 'place': return '📍';
      case 'river': return '🌊';
      case 'boundary': return '📐';
      case 'note': return '📝';
    }
  }
</script>

<div class="h-full flex flex-col gap-3">
  <div class="flex items-center justify-between px-2 flex-shrink-0">
    <div class="flex items-center gap-3 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-ink-700">区域：</span>
        <span class="text-sm font-semibold text-parchment-700">{curTimeline?.region || '-'}</span>
        <span class="text-xs text-ink-400">({curTimeline?.name || '-'})</span>
      </div>
      {#if isCompareMode}
        <span class="tag bg-parchment-600 text-white">对比模式</span>
      {/if}
    </div>
    <div class="flex items-center gap-3">
      {#if isCompareMode}
        <label class="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
          <input type="checkbox" bind:checked={syncViewport} class="rounded border-parchment-300" />
          <span>联动视角</span>
        </label>
        <button class="btn btn-secondary text-sm" on:click={clearCompare}>
          清除对比
        </button>
      {/if}
      <button class="btn btn-secondary text-sm" on:click={exitTimeline}>
        ✕ 退出时序
      </button>
    </div>
  </div>

  {#if versions.length > 0}
    <div class="flex-shrink-0 px-3 py-3 bg-parchment-50 rounded-lg border border-parchment-200">
      <div class="relative">
        <div class="absolute left-0 right-0 top-6 h-0.5 bg-parchment-300"></div>
        <div class="relative h-14 flex items-center">
          {#each versions as v, idx (v.id)}
            {@const pos = getTimelinePosition(v)}
            <button
              class="absolute transform -translate-x-1/2 flex flex-col items-center gap-1 group cursor-pointer z-10"
              style="left: {pos}%"
              on:click={() => appStore.selectTimelineVersion(v.id)}
            >
              <div
                class="w-4 h-4 rounded-full border-2 transition-all"
                class:bg-parchment-600={selectedVersion?.id === v.id}
                class:border-parchment-700={selectedVersion?.id === v.id}
                class:scale-125={selectedVersion?.id === v.id}
                class:bg-white={selectedVersion?.id !== v.id}
                class:border-parchment-400={selectedVersion?.id !== v.id}
                class:group-hover:scale-110={selectedVersion?.id !== v.id}
                class:group-hover:border-parchment-600={selectedVersion?.id !== v.id}
              ></div>
              <div
                class="text-xs font-medium whitespace-nowrap transition-colors"
                class:text-parchment-700={selectedVersion?.id === v.id}
                class:text-ink-600={selectedVersion?.id !== v.id}
              >
                {v.dynasty}
              </div>
              <div
                class="text-[10px] whitespace-nowrap"
                class:text-parchment-600={selectedVersion?.id === v.id}
                class:text-ink-400={selectedVersion?.id !== v.id}
              >
                {v.year}
              </div>
            </button>
          {/each}
        </div>

        <div class="flex items-center justify-between mt-3 pt-2 border-t border-parchment-200">
          <div class="flex items-center gap-2">
            <button
              class="btn btn-secondary text-xs"
              disabled={!selectedVersion || versions.findIndex(v => v.id === selectedVersion.id) === 0}
              on:click={prevVersion}
            >
              ◀ 上一版
            </button>
            <div class="text-sm text-ink-600">
              {selectedVersion ? `第 ${versions.findIndex(v => v.id === selectedVersion.id) + 1} / ${versions.length} 版` : `共 ${versions.length} 版`}
            </div>
            <button
              class="btn btn-secondary text-xs"
              disabled={!selectedVersion || versions.findIndex(v => v.id === selectedVersion.id) === versions.length - 1}
              on:click={nextVersion}
            >
              下一版 ▶
            </button>
          </div>
          {#if selectedVersion}
            <div class="text-xs text-ink-500 flex items-center gap-3">
              <span>📚 {selectedVersion.source}</span>
              {#if selectedVersion.scribe}<span>✍️ {selectedVersion.scribe}</span>{/if}
              {#if selectedVersion.provenance}<span>🏛️ {selectedVersion.provenance}</span>{/if}
              <span>{selectedVersion.yearNumeric}年</span>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <div class="flex-1 flex gap-3 min-h-0">
    {#if isCompareMode && fromVersion && toVersion && fromScheme && toScheme}
      <div class="flex-1 min-w-0 flex flex-col gap-2">
        <div class="flex items-center justify-between px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200 flex-shrink-0">
          <div class="flex items-center gap-2">
            <span class="tag bg-blue-500 text-white">A · 早期</span>
            <span class="text-sm font-semibold text-ink-800">{formatVersionLabel(fromVersion)}</span>
          </div>
          <div class="text-xs text-ink-500 flex items-center gap-2">
            <span>{fromVersion.mapType}</span>
            <span>碎片 {fromScheme.fragments.length}</span>
            <span>批注 {fromScheme.annotations.length}</span>
          </div>
        </div>
        <div class="flex-1 min-h-0">
          <MapCanvas
            scheme={fromScheme}
            selectedFragmentId={null}
            selectedAnnotationId={null}
            activeTool="pan"
            readOnly={true}
            viewportScale={leftViewportScale}
            viewportX={leftViewportX}
            viewportY={leftViewportY}
            on:viewportChange={handleLeftViewportChange}
          />
        </div>
      </div>

      <div class="w-px bg-parchment-300 flex-shrink-0"></div>

      <div class="flex-1 min-w-0 flex flex-col gap-2">
        <div class="flex items-center justify-between px-3 py-1.5 bg-green-50 rounded-lg border border-green-200 flex-shrink-0">
          <div class="flex items-center gap-2">
            <span class="tag bg-green-500 text-white">B · 晚期</span>
            <span class="text-sm font-semibold text-ink-800">{formatVersionLabel(toVersion)}</span>
          </div>
          <div class="text-xs text-ink-500 flex items-center gap-2">
            <span>{toVersion.mapType}</span>
            <span>碎片 {toScheme.fragments.length}</span>
            <span>批注 {toScheme.annotations.length}</span>
          </div>
        </div>
        <div class="flex-1 min-h-0">
          <MapCanvas
            scheme={toScheme}
            selectedFragmentId={null}
            selectedAnnotationId={null}
            activeTool="pan"
            readOnly={true}
            viewportScale={rightViewportScale}
            viewportX={rightViewportX}
            viewportY={rightViewportY}
            on:viewportChange={handleRightViewportChange}
          />
        </div>
      </div>
    {:else if selectedScheme}
      <div class="flex-1 min-w-0 flex flex-col gap-2">
        <div class="flex items-center justify-between px-3 py-1.5 bg-parchment-50 rounded-lg border border-parchment-200 flex-shrink-0">
          <div class="flex items-center gap-2">
            {#if selectedVersion}
              <span class="tag bg-amber-100 text-amber-800">{selectedVersion.dynasty}</span>
              <span class="text-sm font-semibold text-ink-800">{selectedVersion.year}</span>
            {/if}
          </div>
          <div class="text-xs text-ink-500">
            碎片 {selectedScheme.fragments.length} · 批注 {selectedScheme.annotations.length}
          </div>
        </div>
        <div class="flex-1 min-h-0">
          <MapCanvas
            scheme={selectedScheme}
            selectedFragmentId={null}
            selectedAnnotationId={null}
            activeTool="pan"
            readOnly={true}
            viewportScale={leftViewportScale}
            viewportX={leftViewportX}
            viewportY={leftViewportY}
            on:viewportChange={handleLeftViewportChange}
          />
        </div>
      </div>
    {:else}
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center text-ink-500">
          <div class="text-5xl mb-3">🗺️</div>
          {#if versions.length === 0}
            <div class="text-sm">请在左侧添加地图版本</div>
          {:else}
            <div class="text-sm">请从时间轴选择要查看的版本</div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  {#if isCompareMode && pairStats && pairStats.annotationChanges.length > 0}
    <div class="flex-shrink-0 px-3 py-2 bg-parchment-50 rounded-lg border border-parchment-200 max-h-40 overflow-y-auto scrollbar-thin">
      <div class="flex items-center justify-between mb-2">
        <div class="text-sm font-semibold text-ink-700 flex items-center gap-3">
          <span>📊 批注变更明细</span>
          <span class="tag bg-green-100 text-green-700">新增 {pairStats.addedCount}</span>
          <span class="tag bg-red-100 text-red-700">消失 {pairStats.removedCount}</span>
          <span class="tag bg-amber-100 text-amber-700">变更 {pairStats.modifiedCount}</span>
          <span class="tag bg-gray-100 text-gray-600">未变 {pairStats.unchangedCount}</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5">
        {#each pairStats.annotationChanges as change (change.annotationId + change.toVersionId)}
          {#if change.type !== 'unchanged'}
            {@const badge = getChangeBadge(change.type)}
            <div class="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white border border-parchment-200">
              <span>{getChangeIcon(change.annotationType)}</span>
              <span class="font-medium text-ink-800">{change.annotationLabel}</span>
              <span class="tag {badge.cls}">{badge.label}</span>
              {#if change.type === 'modified'}
                <span class="text-ink-400">
                  {#if change.positionChanged}📍{/if}
                  {#if change.pointsChanged}📏{/if}
                  {#if change.fromLabel !== change.toLabel}🏷️{/if}
                </span>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}
</div>
