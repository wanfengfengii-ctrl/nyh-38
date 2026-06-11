<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { EvolutionStatistics, AnnotationType, AnnotationChange, ConfidenceLevel, Evidence } from '@/types';
  import { ANNOTATION_TYPE_LABELS, CONFIDENCE_LABELS, CONFIDENCE_COLORS, CONFIDENCE_ICONS, DYNASTY_OPTIONS } from '@/types';
  import { generateId } from '@/lib/utils';
  import { evolutionStatistics, pairEvolutionStats, appStore, getChangeKey } from '@/lib/store';

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
  const confidenceLevels: ConfidenceLevel[] = ['high', 'medium', 'low', 'pending'];
  const changeTypeLabels: Record<typeof changeTypes[number], string> = {
    all: '全部变化',
    added: '新增',
    removed: '消失',
    modified: '变更',
    unchanged: '未变',
  };

  let filterType: 'all' | AnnotationType = 'all';
  let filterChange: typeof changeTypes[number] = 'all';
  let filterHighConfidenceOnly = false;
  let editingChangeKey: string | null = null;
  let editingConfidence: ConfidenceLevel = 'pending';
  let editingEvidences: Evidence[] = [];

  function openChangeEditor(c: AnnotationChange) {
    editingChangeKey = getChangeKey(c);
    editingConfidence = c.confidence || 'pending';
    editingEvidences = (c.evidences || []).map((e) => ({ ...e }));
  }

  function closeChangeEditor() {
    editingChangeKey = null;
    editingConfidence = 'pending';
    editingEvidences = [];
  }

  function saveChangeEvidence() {
    if (!editingChangeKey) return;
    const cleaned = editingEvidences
      .filter((e) => e.source.trim() || e.pageOrCallNumber.trim() || e.description.trim())
      .map((e) => ({
        id: e.id,
        source: e.source.trim(),
        pageOrCallNumber: e.pageOrCallNumber.trim(),
        description: e.description.trim(),
      }));
    appStore.updateChangeEvidence(editingChangeKey, {
      confidence: editingConfidence,
      evidences: cleaned.length > 0 ? cleaned : undefined,
    });
    closeChangeEditor();
  }

  function addChangeEvidence() {
    editingEvidences = [...editingEvidences, { id: generateId(), source: '', pageOrCallNumber: '', description: '' }];
  }

  function removeChangeEvidence(id: string) {
    editingEvidences = editingEvidences.filter((e) => e.id !== id);
  }

  function updateChangeEvidence(id: string, field: keyof Evidence, value: string) {
    editingEvidences = editingEvidences.map((e) => (e.id === id ? { ...e, [field]: value } : e));
  }

  $: filteredChanges = (activeStats?.annotationChanges || []).filter((c) => {
    if (filterType !== 'all' && c.annotationType !== filterType) return false;
    if (filterChange !== 'all' && c.type !== filterChange) return false;
    if (filterHighConfidenceOnly && c.confidence !== 'high') return false;
    return true;
  });

  $: sortedVersionsByDynasty = (() => {
    if (!activeStats) return [] as [string, number][];
    const orderMap = new Map(DYNASTY_OPTIONS.map((d, i) => [d, i]));
    return Object.entries(activeStats.versionsByDynasty).sort(
      (a, b) => (orderMap.get(a[0]) ?? 999) - (orderMap.get(b[0]) ?? 999)
    );
  })();
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
          <div class="text-sm font-medium text-ink-700 mb-2">朝代版本分布</div>
          <div class="space-y-1.5">
            {#each sortedVersionsByDynasty as [dynasty, count]}
              <div class="flex items-center gap-2">
                <span class="tag bg-amber-100 text-amber-800 text-[10px] w-16 text-center">{dynasty}</span>
                <div class="flex-1 h-2.5 bg-parchment-100 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-amber-500 transition-all"
                    style="width: {calcBarWidth(count, activeStats.versionsCount)}%"
                  ></div>
                </div>
                <span class="text-xs font-semibold text-ink-700 w-6 text-right">{count}</span>
              </div>
            {/each}
            {#if sortedVersionsByDynasty.length === 0}
              <div class="text-xs text-ink-400 italic">暂无数据</div>
            {/if}
          </div>
        </div>

        <div class="border-t border-parchment-200 pt-3">
          <div class="text-sm font-medium text-ink-700 mb-2">版本可信度分布</div>
          <div class="space-y-1.5">
            {#each confidenceLevels as level}
              {@const cc = CONFIDENCE_COLORS[level]}
              {@const val = activeStats.confidenceDistribution[level]}
              <div class="flex items-center gap-2">
                <span class="tag {cc.bg} {cc.text} text-[10px] w-20 text-center">
                  {CONFIDENCE_ICONS[level]} {CONFIDENCE_LABELS[level]}
                </span>
                <div class="flex-1 h-2.5 bg-parchment-100 rounded-full overflow-hidden">
                  <div
                    class="h-full {cc.solid} transition-all"
                    style="width: {calcBarWidth(val, activeStats.versionsCount)}%"
                  ></div>
                </div>
                <span class="text-xs font-semibold text-ink-700 w-6 text-right">{val}</span>
              </div>
            {/each}
          </div>
        </div>

        <div class="border-t border-parchment-200 pt-3">
          <div class="text-sm font-medium text-ink-700 mb-2">证据缺失统计</div>
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-red-50 rounded-md p-2 text-center border border-red-200">
              <div class="text-lg font-bold text-red-700">{activeStats.versionsWithoutEvidence}</div>
              <div class="text-[10px] text-red-600 mt-0.5">缺证据版本</div>
            </div>
            <div class="bg-orange-50 rounded-md p-2 text-center border border-orange-200">
              <div class="text-lg font-bold text-orange-700">{activeStats.changesWithoutEvidence}</div>
              <div class="text-[10px] text-orange-600 mt-0.5">缺证据结论</div>
            </div>
          </div>
          {#if activeStats.changesWithoutEvidence > 0 || activeStats.versionsWithoutEvidence > 0}
            <div class="mt-2 text-[10px] text-orange-600 bg-orange-50 p-1.5 rounded border border-orange-100">
              ⚠️ 建议为上述条目补充文献证据与可信度评级
            </div>
          {/if}
        </div>

        <div class="border-t border-parchment-200 pt-3">
          <div class="text-sm font-medium text-ink-700 mb-2">结论可信度分布</div>
          <div class="grid grid-cols-4 gap-1.5">
            {#each confidenceLevels as level}
              {@const cc = CONFIDENCE_COLORS[level]}
              <div class="rounded p-1.5 text-center border {cc.border} {cc.bg}">
                <div class="text-sm font-bold {cc.text}">{activeStats.changesConfidenceDistribution[level]}</div>
                <div class="text-[9px] {cc.text} mt-0.5">{CONFIDENCE_LABELS[level]}</div>
              </div>
            {/each}
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
          <div class="flex items-center gap-2 mb-2">
            <label class="flex items-center gap-1.5 text-xs text-ink-700 cursor-pointer select-none">
              <input
                type="checkbox"
                bind:checked={filterHighConfidenceOnly}
                class="rounded border-parchment-300"
              />
              <span class="text-green-700 font-medium">✅ 仅看高可信度演变</span>
            </label>
            <span class="text-[10px] text-ink-400">（{filteredChanges.length} 条结果）</span>
          </div>

          {#if filteredChanges.length === 0}
            <div class="text-center text-xs text-ink-400 py-4">
              {filterHighConfidenceOnly ? '暂无高可信度演变结论' : '无符合条件的记录'}
            </div>
          {:else}
            <div class="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin pr-1">
              {#each filteredChanges as c, idx (`${c.annotationId}-${c.toVersionId}-${idx}`)}
                {@const conf = c.confidence || 'pending'}
                {@const cc = CONFIDENCE_COLORS[conf]}
                <div
                  class="flex items-start gap-2 p-2 rounded-md bg-white border-2 text-xs transition-all"
                  class:{cc.border}={c.confidence === 'high'}
                  class:border-green-300={c.confidence === 'high'}
                  class:border-parchment-100={c.confidence !== 'high'}
                >
                  <span class="text-base leading-none mt-0.5">{getTypeIcon(c.annotationType)}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-medium text-ink-800 truncate">{c.annotationLabel}</span>
                      <span class="tag {getChangeClass(c)} text-[10px]">{getChangeLabel(c)}</span>
                      <span class="tag {cc.bg} {cc.text} text-[10px]" title={CONFIDENCE_LABELS[conf]}>
                        {CONFIDENCE_ICONS[conf]}
                      </span>
                      {#if c.evidences && c.evidences.length > 0}
                        <span class="tag bg-blue-50 text-blue-700 text-[10px]" title={`${c.evidences.length}条证据`}>
                          📚{c.evidences.length}
                        </span>
                      {/if}
                      <button
                        class="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-parchment-100 hover:bg-parchment-300 text-ink-600 transition-colors"
                        on:click={() => openChangeEditor(c)}
                        title="编辑可信度与证据"
                      >
                        ✎
                      </button>
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
                    {#if c.evidences && c.evidences.length > 0}
                      <div class="mt-1 text-[10px] text-ink-400 italic truncate">
                        📖 {c.evidences[0].source || c.evidences[0].description || '已附证据'}
                        {c.evidences.length > 1 ? ` 等${c.evidences.length}条` : ''}
                      </div>
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

  {#if editingChangeKey}
    <div
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      on:click={closeChangeEditor}
    >
      <div
        class="bg-parchment-50 rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        on:click|stopPropagation
      >
        <div class="panel-header">
          <span>编辑演变结论可信度与证据</span>
          <button
            class="ml-auto text-ink-500 hover:text-ink-800 text-lg leading-none"
            on:click={closeChangeEditor}
          >×</button>
        </div>
        <div class="p-4 space-y-3 overflow-y-auto scrollbar-thin">
          <div>
            <label class="label">可信度等级</label>
            <div class="grid grid-cols-4 gap-1.5">
              {#each confidenceLevels as level}
                {@const cc = CONFIDENCE_COLORS[level]}
                <button
                  type="button"
                  class="text-xs px-2 py-1.5 rounded-md border-2 transition-all flex items-center justify-center gap-1"
                  class:{cc.border}={editingConfidence === level}
                  class:{cc.bg}={editingConfidence === level}
                  class:{cc.text}={editingConfidence === level}
                  class:border-parchment-200={editingConfidence !== level}
                  class:bg-white={editingConfidence !== level}
                  class:text-ink-600={editingConfidence !== level}
                  on:click={() => (editingConfidence = level)}
                >
                  <span>{CONFIDENCE_ICONS[level]}</span>
                  <span class="font-medium">{CONFIDENCE_LABELS[level]}</span>
                </button>
              {/each}
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="label mb-0">证据链</label>
              <button
                type="button"
                class="text-xs px-2 py-0.5 rounded bg-parchment-200 text-ink-700 hover:bg-parchment-300 transition-colors"
                on:click={addChangeEvidence}
              >
                ＋ 添加证据
              </button>
            </div>
            {#if editingEvidences.length === 0}
              <div class="text-xs text-ink-400 italic p-3 bg-parchment-100 rounded-md text-center">
                暂无证据记录
              </div>
            {:else}
              <div class="space-y-2">
                {#each editingEvidences as ev, idx (ev.id)}
                  <div class="p-2.5 bg-white border border-parchment-200 rounded-md space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-medium text-ink-600">证据 {idx + 1}</span>
                      <button
                        type="button"
                        class="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors"
                        on:click={() => removeChangeEvidence(ev.id)}
                      >
                        删除
                      </button>
                    </div>
                    <div>
                      <input
                        class="input text-xs"
                        placeholder="📖 文献出处（如：《水经注》卷四十）"
                        value={ev.source}
                        on:input={(e) => updateChangeEvidence(ev.id, 'source', (e.target as HTMLInputElement).value)}
                      />
                    </div>
                    <div class="grid grid-cols-2 gap-1.5">
                      <input
                        class="input text-xs"
                        placeholder="📄 页码 / 馆藏号"
                        value={ev.pageOrCallNumber}
                        on:input={(e) => updateChangeEvidence(ev.id, 'pageOrCallNumber', (e.target as HTMLInputElement).value)}
                      />
                      <input
                        class="input text-xs"
                        placeholder="✍️ 证据说明"
                        value={ev.description}
                        on:input={(e) => updateChangeEvidence(ev.id, 'description', (e.target as HTMLInputElement).value)}
                      />
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
        <div class="p-4 border-t border-parchment-200 flex gap-2 justify-end">
          <button class="btn btn-secondary text-sm" on:click={closeChangeEditor}>取消</button>
          <button class="btn btn-primary text-sm" on:click={saveChangeEvidence}>保存</button>
        </div>
      </div>
    </div>
  {/if}
</div>
