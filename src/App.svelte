<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { AnnotationType, ToolType } from '@/types';
  import {
    appStore,
    currentScheme,
    statistics,
    selectedFragment,
    leftCompareScheme,
    rightCompareScheme,
  } from '@/lib/store';

  import Toolbar from '@/components/Toolbar.svelte';
  import MapCanvas from '@/components/MapCanvas.svelte';
  import FragmentPanel from '@/components/FragmentPanel.svelte';
  import AnnotationPanel from '@/components/AnnotationPanel.svelte';
  import SchemePanel from '@/components/SchemePanel.svelte';
  import StatisticsPanel from '@/components/StatisticsPanel.svelte';
  import FragmentProperties from '@/components/FragmentProperties.svelte';
  import CompareView from '@/components/CompareView.svelte';
  import ImportFragmentDialog from '@/components/ImportFragmentDialog.svelte';
  import ImportSchemeDialog from '@/components/ImportSchemeDialog.svelte';
  import Toast from '@/components/Toast.svelte';

  let schemes = $appStore.schemes;
  let currentSchemeId = $appStore.currentSchemeId;
  let selectedFragmentId = $appStore.selectedFragmentId;
  let selectedAnnotationId = $appStore.selectedAnnotationId;
  let activeTool: ToolType = $appStore.activeTool;
  let isCompareMode = $appStore.isCompareMode;
  let stats = $statistics;
  let selFragment = $selectedFragment;
  let curScheme = $currentScheme;
  let leftCompare = $leftCompareScheme;
  let rightCompare = $rightCompareScheme;

  const unsubscribe = appStore.subscribe(($s) => {
    schemes = $s.schemes;
    currentSchemeId = $s.currentSchemeId;
    selectedFragmentId = $s.selectedFragmentId;
    selectedAnnotationId = $s.selectedAnnotationId;
    activeTool = $s.activeTool;
    isCompareMode = $s.isCompareMode;
  });

  const unsubStats = statistics.subscribe((v) => (stats = v));
  const unsubSelFrag = selectedFragment.subscribe((v) => (selFragment = v));
  const unsubCurrent = currentScheme.subscribe((v) => (curScheme = v));
  const unsubLeft = leftCompareScheme.subscribe((v) => (leftCompare = v));
  const unsubRight = rightCompareScheme.subscribe((v) => (rightCompare = v));

  let importFragmentOpen = false;
  let importSchemeOpen = false;
  let toastVisible = false;
  let toastMessage = '';
  let toastType: 'info' | 'success' | 'warning' | 'error' = 'info';
  let leftPanelTab: 'fragments' | 'schemes' = 'fragments';
  let rightPanelTab: 'annotations' | 'properties' | 'statistics' = 'properties';

  function showToast(msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    toastMessage = msg;
    toastType = type;
    toastVisible = false;
    requestAnimationFrame(() => {
      toastVisible = true;
    });
  }

  function handleFragmentTransform(e: {
    detail: { id: string; x: number; y: number; rotation: number; scaleX: number; scaleY: number };
  }) {
    const { id, ...updates } = e.detail;
    appStore.updateFragment(id, updates);
  }

  function handleFragmentSelect(e: { detail: string | null }) {
    appStore.setSelectedFragment(e.detail);
  }

  function handleAnnotationSelect(e: { detail: string | null }) {
    appStore.setSelectedAnnotation(e.detail);
  }

  function handleAnnotationCreate(e: {
    detail: { type: string; fragmentId: string; data: Record<string, unknown> };
  }) {
    const { type, fragmentId, data } = e.detail;
    const created = appStore.addAnnotation(type as AnnotationType, {
      fragmentId,
      ...data,
    });
    if (created) {
      const label = type === 'place' ? '地名' : type === 'river' ? '河道' : type === 'boundary' ? '边界' : '注释';
      showToast(`已添加${label}批注`, 'success');
    }
  }

  function handleFragmentDblClick(e: { detail: string }) {
    appStore.bringFragmentToFront(e.detail);
    appStore.setSelectedFragment(e.detail);
  }

  function handleImportFragments(e: {
    detail: { name: string; imageSrc: string; originalWidth: number; originalHeight: number }[];
  }) {
    const items = e.detail;
    let successCount = 0;
    const failNames: string[] = [];
    for (const item of items) {
      const result = appStore.addFragment(item);
      if (result.success) {
        successCount++;
      } else if (result.error) {
        failNames.push(item.name);
      }
    }
    importFragmentOpen = false;
    if (successCount > 0) {
      showToast(`成功导入 ${successCount} 个碎片`, 'success');
    }
    if (failNames.length > 0) {
      showToast(`以下碎片名称重复：${failNames.join('、')}`, 'warning');
    }
    appStore.saveToLocalStorage();
  }

  function handleImportScheme(e: { detail: string }) {
    const json = e.detail;
    const result = appStore.importScheme(json);
    importSchemeOpen = false;
    if (result.success) {
      showToast('方案导入成功', 'success');
    } else {
      showToast(`导入失败：${result.error || '未知错误'}`, 'error');
    }
    appStore.saveToLocalStorage();
  }

  function handleSave() {
    appStore.saveToLocalStorage();
    showToast('已保存到本地存储', 'success');
  }

  let autoSaveTimer: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    appStore.loadFromLocalStorage();
    autoSaveTimer = setInterval(() => {
      appStore.saveToLocalStorage();
    }, 30000);
  });

  onDestroy(() => {
    if (autoSaveTimer) clearInterval(autoSaveTimer);
    unsubscribe();
    unsubStats();
    unsubSelFrag();
    unsubCurrent();
    unsubLeft();
    unsubRight();
  });
</script>

<div class="h-screen w-screen flex flex-col bg-parchment-50 overflow-hidden">
  <header class="flex-shrink-0 bg-parchment-100 border-b border-parchment-200 px-4 py-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="text-2xl">📜</div>
        <div>
          <h1 class="text-lg font-bold text-ink-900 tracking-wide">古地图拼接批注与比对系统</h1>
          <p class="text-xs text-ink-500">Ancient Map Assembly & Annotation Platform</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Toolbar />
        <div class="w-px h-8 bg-parchment-300 mx-1"></div>
        <button
          class="btn btn-secondary text-xs"
          title="手动保存"
          on:click={handleSave}
        >
          💾 保存
        </button>
      </div>
    </div>
  </header>

  <main class="flex-1 flex overflow-hidden">
    <aside class="w-72 flex-shrink-0 border-r border-parchment-200 bg-parchment-50 flex flex-col">
      <div class="flex-shrink-0 px-3 pt-3 pb-2 flex gap-1 border-b border-parchment-200">
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          class:bg-parchment-600={leftPanelTab === 'fragments'}
          class:text-white={leftPanelTab === 'fragments'}
          class:text-ink-600={leftPanelTab !== 'fragments'}
          class:hover:bg-parchment-200={leftPanelTab !== 'fragments'}
          on:click={() => (leftPanelTab = 'fragments')}
        >
          🖼️ 碎片
        </button>
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          class:bg-parchment-600={leftPanelTab === 'schemes'}
          class:text-white={leftPanelTab === 'schemes'}
          class:text-ink-600={leftPanelTab !== 'schemes'}
          class:hover:bg-parchment-200={leftPanelTab !== 'schemes'}
          on:click={() => (leftPanelTab = 'schemes')}
        >
          📁 方案
        </button>
      </div>
      <div class="flex-1 overflow-hidden p-3">
        {#if leftPanelTab === 'fragments'}
          <FragmentPanel
            scheme={curScheme}
            selectedFragmentId={selectedFragmentId}
            on:import={() => (importFragmentOpen = true)}
          />
        {:else}
          <SchemePanel
            schemes={schemes}
            currentSchemeId={currentSchemeId}
            on:import={() => (importSchemeOpen = true)}
          />
        {/if}
      </div>
    </aside>

    <section class="flex-1 overflow-hidden p-3 flex flex-col min-w-0">
      <div class="flex-1 min-h-0">
        {#if isCompareMode}
          <CompareView
            schemes={schemes}
            leftScheme={leftCompare}
            rightScheme={rightCompare}
          />
        {:else}
          <div class="h-full flex flex-col gap-2">
            <div class="flex items-center justify-between px-3 py-1.5 bg-parchment-50 rounded-lg border border-parchment-200 flex-shrink-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-ink-800">
                  {#if curScheme}
                    {curScheme.name}
                  {:else}
                    未选择方案
                  {/if}
                </span>
                {#if activeTool !== 'select' && activeTool !== 'pan'}
                  <span class="tag bg-parchment-600 text-white">
                    {#if activeTool === 'annotate-place'}📍 地名标注模式{/if}
                    {#if activeTool === 'annotate-river'}🌊 河道绘制模式（Shift结束）{/if}
                    {#if activeTool === 'annotate-boundary'}📐 边界绘制模式（Shift结束）{/if}
                    {#if activeTool === 'annotate-note'}📝 注释添加模式{/if}
                  </span>
                {/if}
              </div>
              <div class="text-xs text-ink-500 flex items-center gap-3">
                <span>滚轮缩放</span>
                <span>拖拽变换</span>
                <span>双击置顶</span>
              </div>
            </div>
            <div class="flex-1 min-h-0">
              <MapCanvas
                scheme={curScheme}
                selectedFragmentId={selectedFragmentId}
                selectedAnnotationId={selectedAnnotationId}
                activeTool={activeTool}
                on:fragmentSelect={handleFragmentSelect}
                on:fragmentTransform={handleFragmentTransform}
                on:fragmentDblClick={handleFragmentDblClick}
                on:annotationSelect={handleAnnotationSelect}
                on:annotationCreate={handleAnnotationCreate}
              />
            </div>
          </div>
        {/if}
      </div>
    </section>

    <aside class="w-80 flex-shrink-0 border-l border-parchment-200 bg-parchment-50 flex flex-col">
      <div class="flex-shrink-0 px-3 pt-3 pb-2 flex gap-1 border-b border-parchment-200">
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          class:bg-parchment-600={rightPanelTab === 'annotations'}
          class:text-white={rightPanelTab === 'annotations'}
          class:text-ink-600={rightPanelTab !== 'annotations'}
          class:hover:bg-parchment-200={rightPanelTab !== 'annotations'}
          on:click={() => (rightPanelTab = 'annotations')}
        >
          📝 批注
        </button>
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          class:bg-parchment-600={rightPanelTab === 'properties'}
          class:text-white={rightPanelTab === 'properties'}
          class:text-ink-600={rightPanelTab !== 'properties'}
          class:hover:bg-parchment-200={rightPanelTab !== 'properties'}
          on:click={() => (rightPanelTab = 'properties')}
        >
          ⚙️ 属性
        </button>
        <button
          class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          class:bg-parchment-600={rightPanelTab === 'statistics'}
          class:text-white={rightPanelTab === 'statistics'}
          class:text-ink-600={rightPanelTab !== 'statistics'}
          class:hover:bg-parchment-200={rightPanelTab !== 'statistics'}
          on:click={() => (rightPanelTab = 'statistics')}
        >
          📊 统计
        </button>
      </div>
      <div class="flex-1 overflow-hidden p-3">
        {#if rightPanelTab === 'annotations'}
          <AnnotationPanel
            scheme={curScheme}
            selectedAnnotationId={selectedAnnotationId}
            editingAnnotation={null}
            on:select={(ev) => appStore.setSelectedAnnotation(ev.detail)}
          />
        {:else if rightPanelTab === 'properties'}
          <FragmentProperties
            fragment={selFragment}
            scheme={curScheme}
          />
        {:else}
          {#if stats}
            <StatisticsPanel stats={stats} />
          {/if}
        {/if}
      </div>
    </aside>
  </main>
</div>

<ImportFragmentDialog
  open={importFragmentOpen}
  on:confirm={handleImportFragments}
  on:cancel={() => (importFragmentOpen = false)}
/>

<ImportSchemeDialog
  open={importSchemeOpen}
  on:confirm={handleImportScheme}
  on:cancel={() => (importSchemeOpen = false)}
/>

<Toast message={toastMessage} visible={toastVisible} type={toastType} />
