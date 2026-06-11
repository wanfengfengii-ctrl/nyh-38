<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type { Timeline, MapVersion, AssemblyScheme, ConfidenceLevel, Evidence } from '@/types';
  import { DYNASTY_OPTIONS, MAP_TYPE_OPTIONS, CONFIDENCE_LABELS, CONFIDENCE_COLORS, CONFIDENCE_ICONS } from '@/types';
  import { generateId } from '@/lib/utils';
  import {
    appStore,
    currentTimeline,
    currentTimelineVersions,
    evolutionStatistics,
  } from '@/lib/store';

  export let schemes: AssemblyScheme[] = [];

  const dispatch = createEventDispatcher<{
    openTimeline: string;
  }>();

  let timelines = $appStore.timelines;
  let mapVersions = $appStore.mapVersions;
  let currentTimelineId = $appStore.currentTimelineId;
  let curTimeline = $currentTimeline;
  let versions = $currentTimelineVersions;
  let evoStats = $evolutionStatistics;

  const unsubApp = appStore.subscribe(($s) => {
    timelines = $s.timelines;
    mapVersions = $s.mapVersions;
    currentTimelineId = $s.currentTimelineId;
  });
  const unsubCur = currentTimeline.subscribe((v) => (curTimeline = v));
  const unsubVers = currentTimelineVersions.subscribe((v) => (versions = v));
  const unsubStats = evolutionStatistics.subscribe((v) => (evoStats = v));
  onDestroy(() => {
    unsubApp();
    unsubCur();
    unsubVers();
    unsubStats();
  });

  let showNewTimeline = false;
  let newTimelineName = '';
  let newTimelineRegion = '';
  let newTimelineDesc = '';

  let renamingId: string | null = null;
  let renameValue = '';
  let showVersionForm = false;
  let editingVersionId: string | null = null;

  let vSchemeId = '';
  let vDynasty: string = DYNASTY_OPTIONS[0] as string;
  let vYear = '';
  let vYearNumeric = 0;
  let vSource = '';
  let vMapType: string = MAP_TYPE_OPTIONS[0] as string;
  let vScribe = '';
  let vProvenance = '';
  let vNotes = '';
  let vConfidence: ConfidenceLevel = 'pending';
  let vEvidences: Evidence[] = [];

  const confidenceLevels: ConfidenceLevel[] = ['high', 'medium', 'low', 'pending'];
  const dynastyList: string[] = DYNASTY_OPTIONS as unknown as string[];
  const mapTypeList: string[] = MAP_TYPE_OPTIONS as unknown as string[];

  function createTimeline() {
    if (!newTimelineName.trim() || !newTimelineRegion.trim()) return;
    const id = appStore.createTimeline(newTimelineName.trim(), newTimelineRegion.trim(), newTimelineDesc.trim());
    newTimelineName = '';
    newTimelineRegion = '';
    newTimelineDesc = '';
    showNewTimeline = false;
    appStore.setTimelineMode(true);
    dispatch('openTimeline', id);
  }

  function startRename(t: Timeline) {
    renamingId = t.id;
    renameValue = t.name;
  }

  function saveRename() {
    if (renamingId && renameValue.trim()) {
      appStore.updateTimeline(renamingId, { name: renameValue.trim() });
    }
    renamingId = null;
  }

  function switchTimeline(id: string) {
    appStore.switchTimeline(id);
    appStore.setTimelineMode(true);
    dispatch('openTimeline', id);
  }

  function deleteTimeline(id: string) {
    if (confirm('确定要删除该时间轴及其所有版本记录吗？地图方案本身不会被删除。')) {
      appStore.deleteTimeline(id);
    }
  }

  function openVersionForm(version?: MapVersion) {
    if (version) {
      editingVersionId = version.id;
      vSchemeId = version.schemeId;
      vDynasty = version.dynasty;
      vYear = version.year;
      vYearNumeric = version.yearNumeric;
      vSource = version.source;
      vMapType = version.mapType;
      vScribe = version.scribe || '';
      vProvenance = version.provenance || '';
      vNotes = version.notes || '';
      vConfidence = version.confidence || 'pending';
      vEvidences = (version.evidences || []).map((e) => ({ ...e }));
    } else {
      editingVersionId = null;
      vSchemeId = schemes[0]?.id || '';
      vDynasty = DYNASTY_OPTIONS[0];
      vYear = '';
      vYearNumeric = 0;
      vSource = '';
      vMapType = MAP_TYPE_OPTIONS[0];
      vScribe = '';
      vProvenance = '';
      vNotes = '';
      vConfidence = 'pending';
      vEvidences = [];
    }
    showVersionForm = true;
  }

  function addEvidence() {
    vEvidences = [...vEvidences, { id: generateId(), source: '', pageOrCallNumber: '', description: '' }];
  }

  function removeEvidence(id: string) {
    vEvidences = vEvidences.filter((e) => e.id !== id);
  }

  function updateEvidence(id: string, field: keyof Evidence, value: string) {
    vEvidences = vEvidences.map((e) => (e.id === id ? { ...e, [field]: value } : e));
  }

  function submitVersion() {
    if (!curTimeline) return;
    if (!vSchemeId || !vYear.trim() || !vSource.trim()) return;

    const cleanedEvidences = vEvidences
      .filter((e) => e.source.trim() || e.pageOrCallNumber.trim() || e.description.trim())
      .map((e) => ({
        id: e.id,
        source: e.source.trim(),
        pageOrCallNumber: e.pageOrCallNumber.trim(),
        description: e.description.trim(),
      }));

    const data = {
      schemeId: vSchemeId,
      dynasty: vDynasty,
      year: vYear.trim(),
      yearNumeric: vYearNumeric,
      source: vSource.trim(),
      mapType: vMapType,
      scribe: vScribe.trim() || undefined,
      provenance: vProvenance.trim() || undefined,
      notes: vNotes.trim() || undefined,
      confidence: vConfidence,
      evidences: cleanedEvidences.length > 0 ? cleanedEvidences : undefined,
    };

    if (editingVersionId) {
      appStore.updateMapVersion(editingVersionId, data);
    } else {
      const newId = appStore.addMapVersion(curTimeline.id, data);
      if (newId) {
        appStore.selectTimelineVersion(newId);
      }
    }
    showVersionForm = false;
    editingVersionId = null;
  }

  function deleteVersion(id: string) {
    if (confirm('确定删除该版本记录？（地图方案不会被删除）')) {
      appStore.removeMapVersion(id);
    }
  }

  function selectVersion(id: string) {
    appStore.selectTimelineVersion(id);
  }

  function setAsCompareFrom(id: string) {
    const state = $appStore;
    const toId = state.timelineCompareToId === id ? null : state.timelineCompareToId;
    appStore.setTimelineCompare(id, toId);
  }

  function setAsCompareTo(id: string) {
    const state = $appStore;
    const fromId = state.timelineCompareFromId === id ? null : state.timelineCompareFromId;
    appStore.setTimelineCompare(fromId, id);
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<div class="panel h-full flex flex-col">
  <div class="panel-header">
    <span>🗓️ 时序演变</span>
    <div class="flex gap-1 ml-auto">
      <button
        class="btn btn-primary text-xs"
        on:click={() => (showNewTimeline = !showNewTimeline)}
      >
        {showNewTimeline ? '取消' : '＋ 新建时间轴'}
      </button>
    </div>
  </div>

  {#if showNewTimeline}
    <div class="p-2 border-b border-parchment-200 bg-parchment-100 space-y-2">
      <input
        class="input text-sm"
        placeholder="时间轴名称（如：江南地区历史地图演变）"
        bind:value={newTimelineName}
      />
      <input
        class="input text-sm"
        placeholder="研究区域（如：江南 / 关中 / 西域）"
        bind:value={newTimelineRegion}
      />
      <textarea
        class="input text-sm"
        rows="2"
        placeholder="描述（可选）"
        bind:value={newTimelineDesc}
      ></textarea>
      <div class="flex gap-1">
        <button
          class="btn btn-primary text-xs flex-1"
          disabled={!newTimelineName.trim() || !newTimelineRegion.trim()}
          on:click={createTimeline}
        >
          创建
        </button>
      </div>
    </div>
  {/if}

  <div class="flex-1 overflow-y-auto scrollbar-thin">
    {#if timelines.length === 0}
      <div class="p-4 text-center text-sm text-ink-500">
        <div class="text-3xl mb-2">📜</div>
        <div>尚无时间轴</div>
        <div class="mt-1 text-xs text-ink-400">点击上方按钮创建</div>
      </div>
    {:else}
      <div class="p-2 space-y-2 border-b border-parchment-200">
        <div class="text-xs font-semibold text-ink-600 px-1">时间轴列表</div>
        {#each timelines as t (t.id)}
          <div
            class="rounded-lg border p-2 transition-all cursor-pointer"
            class:border-parchment-600={t.id === currentTimelineId}
            class:bg-parchment-200={t.id === currentTimelineId}
            class:border-parchment-200={t.id !== currentTimelineId}
            class:bg-parchment-50={t.id !== currentTimelineId}
            on:click={() => renamingId !== t.id && switchTimeline(t.id)}
          >
            {#if renamingId === t.id}
              <div class="flex gap-1">
                <input
                  class="input text-sm flex-1"
                  bind:value={renameValue}
                  on:keydown={(e) => e.key === 'Enter' && saveRename()}
                  on:blur={saveRename}
                />
                <button class="btn btn-primary text-xs" on:click|stopPropagation={saveRename}>确定</button>
              </div>
            {:else}
              <div class="flex items-start gap-2">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    {#if t.id === currentTimelineId}
                      <span class="tag bg-parchment-600 text-white">当前</span>
                    {/if}
                    <span class="font-medium text-ink-800 text-sm truncate">{t.name}</span>
                  </div>
                  <div class="text-xs text-ink-500 mt-0.5">
                    📍 {t.region} · {t.versionIds.length} 版本
                  </div>
                  {#if t.description}
                    <div class="text-xs text-ink-400 mt-0.5 truncate">{t.description}</div>
                  {/if}
                </div>
                <div class="flex flex-col gap-0.5">
                  <button
                    title="重命名"
                    class="p-1 rounded hover:bg-parchment-300 text-ink-600"
                    on:click|stopPropagation={() => startRename(t)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    title="删除"
                    class="p-1 rounded hover:bg-red-200 text-red-600"
                    on:click|stopPropagation={() => deleteTimeline(t.id)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if curTimeline}
      <div class="p-2 border-b border-parchment-200 flex items-center justify-between bg-parchment-100">
        <div class="text-xs font-semibold text-ink-700">版本记录 ({versions.length})</div>
        <button
          class="btn btn-primary text-xs"
          disabled={schemes.length === 0}
          on:click={() => openVersionForm()}
        >
          ＋ 添加
        </button>
      </div>

      {#if versions.length === 0}
        <div class="p-4 text-center text-sm text-ink-500">
          <div class="text-2xl mb-1">📅</div>
          <div>暂无版本记录</div>
          <div class="text-xs text-ink-400 mt-1">点击上方添加版本</div>
        </div>
      {:else}
        <div class="p-2 space-y-2">
          {#each versions as v, idx (v.id)}
            <div
              class="rounded-lg border p-2 transition-all"
              class:border-parchment-600={$appStore.timelineSelectedVersionId === v.id}
              class:bg-parchment-200={$appStore.timelineSelectedVersionId === v.id}
              class:border-parchment-200={$appStore.timelineSelectedVersionId !== v.id}
              class:bg-parchment-50={$appStore.timelineSelectedVersionId !== v.id}
            >
              <div
                class="cursor-pointer"
                on:click={() => selectVersion(v.id)}
              >
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="tag bg-amber-100 text-amber-800">{v.dynasty}</span>
                  <span class="font-semibold text-sm text-ink-800">{v.year}</span>
                  {#if v.confidence}
                    {@const cc = CONFIDENCE_COLORS[v.confidence]}
                    <span class="tag {cc.bg} {cc.text}" title={CONFIDENCE_LABELS[v.confidence]}>
                      {CONFIDENCE_ICONS[v.confidence]} {CONFIDENCE_LABELS[v.confidence]}
                    </span>
                  {/if}
                  {#if v.evidences && v.evidences.length > 0}
                    <span class="tag bg-blue-50 text-blue-700" title="证据条目">📚 {v.evidences.length}</span>
                  {/if}
                  {#if $appStore.timelineSelectedVersionId === v.id}
                    <span class="tag bg-parchment-600 text-white ml-auto">查看中</span>
                  {/if}
                </div>
                <div class="text-xs text-ink-600 mt-1">
                  {v.mapType} · 来源：{v.source}
                </div>
                <div class="text-xs text-ink-400 mt-0.5">
                  {v.yearNumeric} 年 · {schemes.find(s => s.id === v.schemeId)?.name || '未知方案'}
                </div>
              </div>

              <div class="mt-2 pt-2 border-t border-parchment-200 flex items-center gap-1 flex-wrap">
                <button
                  class="text-xs px-2 py-1 rounded transition-colors"
                  class:bg-blue-500={$appStore.timelineCompareFromId === v.id}
                  class:text-white={$appStore.timelineCompareFromId === v.id}
                  class:bg-blue-100={$appStore.timelineCompareFromId !== v.id}
                  class:text-blue-700={$appStore.timelineCompareFromId !== v.id}
                  on:click={() => setAsCompareFrom(v.id)}
                  title="设为对比起点"
                >
                  A起
                </button>
                <button
                  class="text-xs px-2 py-1 rounded transition-colors"
                  class:bg-green-500={$appStore.timelineCompareToId === v.id}
                  class:text-white={$appStore.timelineCompareToId === v.id}
                  class:bg-green-100={$appStore.timelineCompareToId !== v.id}
                  class:text-green-700={$appStore.timelineCompareToId !== v.id}
                  on:click={() => setAsCompareTo(v.id)}
                  title="设为对比终点"
                >
                  B止
                </button>
                <button
                  class="text-xs px-2 py-1 rounded bg-parchment-100 text-ink-700 hover:bg-parchment-200 ml-auto"
                  on:click={() => openVersionForm(v)}
                >
                  ✎
                </button>
                <button
                  class="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                  on:click={() => deleteVersion(v.id)}
                >
                  🗑
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  {#if showVersionForm}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" on:click={() => (showVersionForm = false)}>
      <div
        class="bg-parchment-50 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col"
        on:click|stopPropagation
      >
        <div class="panel-header">
          <span>{editingVersionId ? '编辑版本信息' : '添加地图版本'}</span>
          <button
            class="ml-auto text-ink-500 hover:text-ink-800 text-lg leading-none"
            on:click={() => (showVersionForm = false)}
          >×</button>
        </div>
        <div class="p-4 space-y-3 overflow-y-auto scrollbar-thin">
          <div>
            <label class="label">关联地图方案 *</label>
            <select class="input text-sm" bind:value={vSchemeId}>
              {#each schemes as s}
                <option value={s.id}>{s.name}（{s.fragments.length}碎片 / {s.annotations.length}批注）</option>
              {/each}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="label">朝代 *</label>
              <select class="input text-sm" bind:value={vDynasty}>
                {#each dynastyList as d}
                  <option value={d}>{d}</option>
                {/each}
              </select>
            </div>
            <div>
              <label class="label">年份（显示）*</label>
              <input
                class="input text-sm"
                placeholder="如：贞观元年 / 康熙23年"
                bind:value={vYear}
              />
            </div>
          </div>

          <div>
            <label class="label">公元纪年（用于排序）*</label>
            <input
              class="input text-sm"
              type="number"
              placeholder="如：627 / 1684（公元前用负数）"
              bind:value={vYearNumeric}
            />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="label">来源 *</label>
              <input
                class="input text-sm"
                placeholder="如：元和郡县图志 / 大清一统志"
                bind:value={vSource}
              />
            </div>
            <div>
              <label class="label">地图类型</label>
              <select class="input text-sm" bind:value={vMapType}>
                {#each mapTypeList as mt}
                  <option value={mt}>{mt}</option>
                {/each}
              </select>
            </div>
          </div>

          <div>
            <label class="label">绘者 / 编纂者</label>
            <input class="input text-sm" placeholder="如：李吉甫 / 张廷玉" bind:value={vScribe} />
          </div>

          <div>
            <label class="label">版本 / 藏馆</label>
            <input class="input text-sm" placeholder="如：武英殿本 / 国图藏本" bind:value={vProvenance} />
          </div>

          <div>
            <label class="label">版本可信度</label>
            <div class="grid grid-cols-4 gap-1.5">
              {#each confidenceLevels as level}
                {@const cc = CONFIDENCE_COLORS[level]}
                <button
                  type="button"
                  class="text-xs px-2 py-1.5 rounded-md border-2 transition-all flex items-center justify-center gap-1"
                  class:{cc.border}={vConfidence === level}
                  class:{cc.bg}={vConfidence === level}
                  class:{cc.text}={vConfidence === level}
                  class:border-parchment-200={vConfidence !== level}
                  class:bg-white={vConfidence !== level}
                  class:text-ink-600={vConfidence !== level}
                  on:click={() => (vConfidence = level)}
                >
                  <span>{CONFIDENCE_ICONS[level]}</span>
                  <span class="font-medium">{CONFIDENCE_LABELS[level]}</span>
                </button>
              {/each}
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="label mb-0">证据链（文献出处）</label>
              <button
                type="button"
                class="text-xs px-2 py-0.5 rounded bg-parchment-200 text-ink-700 hover:bg-parchment-300 transition-colors"
                on:click={addEvidence}
              >
                ＋ 添加证据
              </button>
            </div>
            {#if vEvidences.length === 0}
              <div class="text-xs text-ink-400 italic p-3 bg-parchment-100 rounded-md text-center">
                暂无证据记录，点击上方按钮添加
              </div>
            {:else}
              <div class="space-y-2">
                {#each vEvidences as ev, idx (ev.id)}
                  <div class="p-2.5 bg-white border border-parchment-200 rounded-md space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-medium text-ink-600">证据 {idx + 1}</span>
                      <button
                        type="button"
                        class="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-1.5 py-0.5 rounded transition-colors"
                        on:click={() => removeEvidence(ev.id)}
                      >
                        删除
                      </button>
                    </div>
                    <div>
                      <input
                        class="input text-xs"
                        placeholder="📖 文献出处（如：《水经注》卷四十）"
                        value={ev.source}
                        on:input={(e) => updateEvidence(ev.id, 'source', (e.target as HTMLInputElement).value)}
                      />
                    </div>
                    <div class="grid grid-cols-2 gap-1.5">
                      <input
                        class="input text-xs"
                        placeholder="📄 页码 / 馆藏号"
                        value={ev.pageOrCallNumber}
                        on:input={(e) => updateEvidence(ev.id, 'pageOrCallNumber', (e.target as HTMLInputElement).value)}
                      />
                      <input
                        class="input text-xs"
                        placeholder="✍️ 证据说明（简要描述）"
                        value={ev.description}
                        on:input={(e) => updateEvidence(ev.id, 'description', (e.target as HTMLInputElement).value)}
                      />
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div>
            <label class="label">备注</label>
            <textarea class="input text-sm" rows="2" bind:value={vNotes}></textarea>
          </div>
        </div>
        <div class="p-4 border-t border-parchment-200 flex gap-2 justify-end">
          <button class="btn btn-secondary text-sm" on:click={() => (showVersionForm = false)}>取消</button>
          <button
            class="btn btn-primary text-sm"
            disabled={!vSchemeId || !vYear.trim() || !vSource.trim()}
            on:click={submitVersion}
          >
            {editingVersionId ? '保存' : '添加'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
