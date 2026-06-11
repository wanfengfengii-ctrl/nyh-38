<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MapFragment, AssemblyScheme, Annotation } from '@/types';
  import { ANNOTATION_TYPE_LABELS } from '@/types';
  import { appStore } from '@/lib/store';
  import { getAnnotationsByFragmentId } from '@/lib/utils';
  import ConfirmDialog from './ConfirmDialog.svelte';

  export let scheme: AssemblyScheme | null = null;
  export let selectedFragmentId: string | null = null;
  const dispatch = createEventDispatcher<{
    import: void;
  }>();

  let deletingId: string | null = null;
  let deleteDialogOpen = false;

  function selectFragment(id: string) {
    appStore.setSelectedFragment(id);
  }

  function toggleVisibility(id: string) {
    appStore.toggleFragmentVisibility(id);
  }

  function bringToFront(id: string) {
    appStore.bringFragmentToFront(id);
  }

  function sendToBack(id: string) {
    appStore.sendFragmentToBack(id);
  }

  function toggleMatch(id: string) {
    if (!scheme) return;
    const frag = scheme.fragments.find((f) => f.id === id);
    if (!frag) return;
    const currentlySelected = selectedFragmentId && selectedFragmentId !== id ? [selectedFragmentId] : [];
    appStore.setFragmentMatched(id, currentlySelected, !frag.isMatched);
  }

  function requestDelete(id: string) {
    if (!scheme) return;
    deletingId = id;
    deleteDialogOpen = true;
  }

  function confirmDelete() {
    if (!deletingId) return;
    appStore.forceDeleteFragment(deletingId);
    deleteDialogOpen = false;
    deletingId = null;
  }

  function cancelDelete() {
    deleteDialogOpen = false;
    deletingId = null;
  }

  function getAnnotationCount(fragmentId: string): number {
    if (!scheme) return 0;
    return scheme.annotations.filter((a) => a.fragmentId === fragmentId).length;
  }
</script>

<div class="panel h-full flex flex-col">
  <div class="panel-header justify-between">
    <span>地图碎片</span>
    <button class="btn btn-primary text-xs" on:click={() => dispatch('import')}>
      <span class="mr-1">＋</span> 导入碎片
    </button>
  </div>
  <div class="flex-1 overflow-y-auto scrollbar-thin p-2">
    {#if !scheme || scheme.fragments.length === 0}
      <div class="text-center py-8 text-ink-500 text-sm">
        <div class="text-4xl mb-2">📜</div>
        <div>暂无碎片</div>
        <div class="text-xs mt-1">点击上方按钮导入古地图碎片</div>
      </div>
    {:else}
      <div class="space-y-2">
        {#each scheme.fragments as frag (frag.id)}
          <div
            class="rounded-lg border transition-all cursor-pointer p-2"
            class:border-parchment-500={selectedFragmentId === frag.id}
            class:bg-parchment-200={selectedFragmentId === frag.id}
            class:border-parchment-200={selectedFragmentId !== frag.id}
            class:bg-parchment-50={selectedFragmentId !== frag.id}
            on:click={() => selectFragment(frag.id)}
          >
            <div class="flex items-start gap-2">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-sm font-medium text-ink-800 truncate max-w-[140px]" title={frag.name}>
                    {frag.name}
                  </span>
                  {#if frag.isMatched}
                    <span class="tag bg-green-100 text-green-700">已拼接</span>
                  {/if}
                  {#if !frag.visible}
                    <span class="tag bg-ink-200 text-ink-600">隐藏</span>
                  {/if}
                  {#if getAnnotationCount(frag.id) > 0}
                    <span class="tag bg-blue-100 text-blue-700">
                      批注 {getAnnotationCount(frag.id)}
                    </span>
                  {/if}
                </div>
                <div class="text-xs text-ink-500 mt-1 space-x-2">
                  <span>尺寸: {frag.originalWidth}×{frag.originalHeight}</span>
                  <span>层级: {frag.zIndex}</span>
                </div>
                <div class="text-xs text-ink-500">
                  缩放: {(frag.scaleX * 100).toFixed(0)}% / 旋转: {frag.rotation.toFixed(1)}°
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1 mt-2 flex-wrap">
              <button
                title={frag.visible ? '隐藏' : '显示'}
                class="p-1 rounded hover:bg-parchment-300 text-ink-600"
                on:click|stopPropagation={() => toggleVisibility(frag.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  {#if frag.visible}
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  {:else}
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  {/if}
                </svg>
              </button>
              <button
                title="置顶"
                class="p-1 rounded hover:bg-parchment-300 text-ink-600"
                on:click|stopPropagation={() => bringToFront(frag.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
              </button>
              <button
                title="置底"
                class="p-1 rounded hover:bg-parchment-300 text-ink-600"
                on:click|stopPropagation={() => sendToBack(frag.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>
              <button
                title={frag.isMatched ? '取消拼接' : '设为已拼接'}
                class="p-1 rounded text-ink-600"
                class:hover:bg-green-200={!frag.isMatched}
                class:hover:bg-red-200={frag.isMatched}
                on:click|stopPropagation={() => toggleMatch(frag.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  {#if frag.isMatched}
                    <polyline points="20 6 9 17 4 12"></polyline>
                  {:else}
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                  {/if}
                </svg>
              </button>
              <div class="flex-1"></div>
              <button
                title="删除"
                class="p-1 rounded hover:bg-red-200 text-red-600"
                on:click|stopPropagation={() => requestDelete(frag.id)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<ConfirmDialog
  title="确认删除碎片"
  open={deleteDialogOpen}
  danger={true}
  confirmText="确认删除"
  on:confirm={confirmDelete}
  on:cancel={cancelDelete}
>
  <div class="space-y-3">
    {#if scheme && deletingId && getAnnotationsByFragmentId(scheme.annotations, deletingId).length > 0}
      <div class="text-ink-700">
        该碎片包含 <span class="font-semibold text-red-600">
          {getAnnotationsByFragmentId(scheme.annotations, deletingId).length}
        </span> 条批注，删除碎片将同时删除这些批注：
      </div>
      <div class="bg-parchment-100 rounded-md p-2 max-h-40 overflow-y-auto scrollbar-thin text-sm space-y-1">
        {#each getAnnotationsByFragmentId(scheme.annotations, deletingId) as a}
          <div class="text-ink-600">
            <span class="tag bg-parchment-200 text-ink-700 mr-1">{ANNOTATION_TYPE_LABELS[a.type]}</span>
            {a.label}
          </div>
        {/each}
      </div>
      <div class="text-sm text-ink-500">
        ⚠️ 此操作不可撤销，请确认是否继续删除。
      </div>
    {:else}
      <div class="text-ink-700">
        确定要删除该碎片吗？此操作不可撤销。
      </div>
    {/if}
  </div>
</ConfirmDialog>
