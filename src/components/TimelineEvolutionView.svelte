<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { MapVersion, AnnotationChangeType, ConfidenceLevel } from '@/types';
  import { ANNOTATION_TYPE_LABELS, CONFIDENCE_COLORS, CONFIDENCE_LABELS, CONFIDENCE_ICONS } from '@/types';
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
  let filterHighConfidenceOnly = false;

  function getConfidenceDotColor(v: MapVersion): string {
    const level: ConfidenceLevel = v.confidence || 'pending';
    return CONFIDENCE_COLORS[level].dot;
  }

  $: {
    if (selectedScheme?.viewport) {
      leftViewportScale = selectedScheme.viewport.scale;
      leftViewportX = selectedScheme.viewport.x;
      leftViewportY = selectedScheme.viewport.y;
    }
  }

  $: filteredPairChanges = (pairStats?.annotationChanges || []).filter((c) => {
    if (filterHighConfidenceOnly && c.confidence !== 'high') return false;
    return true;
  });

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
            {@const confColor = getConfidenceDotColor(v)}
            <button
              class="absolute transform -translate-x-1/2 flex flex-col items-center gap-1 group cursor-pointer z-10"
              style="left: {pos}%"
              on:click={() => appStore.selectTimelineVersion(v.id)}
            >
              <div class="relative">
                <div
                  class="w-4 h-4 rounded-full border-2 transition-all"
                  style="border-color: {confColor}; background-color: {selectedVersion?.id === v.id ? confColor : 'white'}"
                  class:scale-125={selectedVersion?.id === v.id}
                  class:group-hover:scale-110={selectedVersion?.id !== v.id}
                ></div>
                {#if v.evidences && v.evidences.length > 0}
                  <div
                    class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-blue-500 text-white text-[8px] flex items-center justify-center font-bold border border-white"
                    title={`${v.evidences.length}条证据`}
                  >
                    {v.evidences.length > 9 ? '9+' : v.evidences.length}
                  </div>
                {/if}
              </div>
              <div
                class="text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-0.5"
                class:text-parchment-700={selectedVersion?.id === v.id}
                class:text-ink-600={selectedVersion?.id !== v.id}
              >
                {v.confidence ? `<span title="${CONFIDENCE_LABELS[v.confidence]}">${CONFIDENCE_ICONS[v.confidence]}</span>` : ''}
                <span>{v.dynasty}</span>
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
        <div class="flex items-center justify-between px-3 py-1.5 rounded-lg border flex-shrink-0"
             class:bg-blue-50={fromVersion?.confidence !== 'high'}
             class:border-blue-200={fromVersion?.confidence !== 'high'}
             class:bg-green-50={fromVersion?.confidence === 'high'}
             class:border-green-300={fromVersion?.confidence === 'high'}
        >
          <div class="flex items-center gap-2 flex-wrap">
            <span class="tag bg-blue-500 text-white">A · 早期</span>
            <span class="text-sm font-semibold text-ink-800">{formatVersionLabel(fromVersion)}</span>
            {#if fromVersion?.confidence}
              {@const fc = CONFIDENCE_COLORS[fromVersion.confidence]}
              <span class="tag {fc.bg} {fc.text} text-[10px]">
                {CONFIDENCE_ICONS[fromVersion.confidence]} {CONFIDENCE_LABELS[fromVersion.confidence]}
              </span>
            {/if}
            {#if fromVersion?.evidences && fromVersion.evidences.length > 0}
              <span class="tag bg-blue-50 text-blue-700 text-[10px]">📚 {fromVersion.evidences.length}条证据</span>
            {/if}
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
        <div class="flex items-center justify-between px-3 py-1.5 rounded-lg border flex-shrink-0"
             class:bg-green-50={toVersion?.confidence !== 'high'}
             class:border-green-200={toVersion?.confidence !== 'high'}
             class:bg-emerald-50={toVersion?.confidence === 'high'}
             class:border-emerald-300={toVersion?.confidence === 'high'}
        >
          <div class="flex items-center gap-2 flex-wrap">
            <span class="tag bg-green-500 text-white">B · 晚期</span>
            <span class="text-sm font-semibold text-ink-800">{formatVersionLabel(toVersion)}</span>
            {#if toVersion?.confidence}
              {@const tc = CONFIDENCE_COLORS[toVersion.confidence]}
              <span class="tag {tc.bg} {tc.text} text-[10px]">
                {CONFIDENCE_ICONS[toVersion.confidence]} {CONFIDENCE_LABELS[toVersion.confidence]}
              </span>
            {/if}
            {#if toVersion?.evidences && toVersion.evidences.length > 0}
              <span class="tag bg-blue-50 text-blue-700 text-[10px]">📚 {toVersion.evidences.length}条证据</span>
            {/if}
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
    <div class="flex-shrink-0 px-3 py-2 bg-parchment-50 rounded-lg border border-parchment-200 max-h-48 overflow-y-auto scrollbar-thin">
      <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div class="text-sm font-semibold text-ink-700 flex items-center gap-2 flex-wrap">
          <span>📊 批注变更明细</span>
          <span class="tag bg-green-100 text-green-700">新增 {pairStats.addedCount}</span>
          <span class="tag bg-red-100 text-red-700">消失 {pairStats.removedCount}</span>
          <span class="tag bg-amber-100 text-amber-700">变更 {pairStats.modifiedCount}</span>
          <span class="tag bg-gray-100 text-gray-600">未变 {pairStats.unchangedCount}</span>
        </div>
        <label class="flex items-center gap-1.5 text-xs text-ink-700 cursor-pointer select-none">
          <input
            type="checkbox"
            bind:checked={filterHighConfidenceOnly}
            class="rounded border-parchment-300"
          />
          <span class="text-green-700 font-medium">✅ 仅看高可信度</span>
        </label>
      </div>
      {#if filteredPairChanges.filter(c => c.type !== 'unchanged').length === 0}
        <div class="text-center text-xs text-ink-400 py-3">
          {filterHighConfidenceOnly ? '暂无高可信度演变结论' : '暂无变更记录'}
        </div>
      {:else}
        <div class="flex flex-wrap gap-1.5">
          {#each filteredPairChanges as change (change.annotationId + change.toVersionId)}
            {#if change.type !== 'unchanged'}
              {@const badge = getChangeBadge(change.type)}
              {@const conf = change.confidence || 'pending'}
              {@const cc = CONFIDENCE_COLORS[conf]}
              <div
                class="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-white border-2 transition-all"
                class:{cc.border}={conf === 'high'}
                class:border-green-300={conf === 'high'}
                class:border-parchment-200={conf !== 'high'}
              >
                <span>{getChangeIcon(change.annotationType)}</span>
                <span class="font-medium text-ink-800">{change.annotationLabel}</span>
                <span class="tag {badge.cls}">{badge.label}</span>
                <span class="tag {cc.bg} {cc.text}" title={CONFIDENCE_LABELS[conf]}>
                  {CONFIDENCE_ICONS[conf]}
                </span>
                {#if change.evidences && change.evidences.length > 0}
                  <span class="tag bg-blue-50 text-blue-700" title={`${change.evidences.length}条证据`}>
                    📚{change.evidences.length}
                  </span>
                {/if}
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
      {/if}
    </div>
  {/if}
</div>
