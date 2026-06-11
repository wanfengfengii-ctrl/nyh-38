<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Annotation, AssemblyScheme } from '@/types';
  import { ANNOTATION_TYPE_LABELS, SYSTEM_CONFIG } from '@/types';
  import { appStore } from '@/lib/store';

  export let scheme: AssemblyScheme | null = null;
  export let selectedAnnotationId: string | null = null;
  export let editingAnnotation: Annotation | null = null;

  const dispatch = createEventDispatcher<{
    select: string | null;
    edit: Annotation;
  }>();

  let editingId: string | null = null;
  let editLabel = '';
  let editDescription = '';
  let editColor = '';

  function startEdit(a: Annotation) {
    editingId = a.id;
    editLabel = a.label;
    editDescription = a.description || '';
    editColor = a.color;
  }

  function saveEdit() {
    if (!editingId) return;
    appStore.updateAnnotation(editingId, {
      label: editLabel,
      description: editDescription,
      color: editColor,
    });
    editingId = null;
  }

  function cancelEdit() {
    editingId = null;
  }

  function deleteAnnotation(id: string) {
    appStore.deleteAnnotation(id);
  }

  function getFragmentName(fragmentId: string): string {
    return scheme?.fragments.find((f) => f.id === fragmentId)?.name || '未知碎片';
  }
</script>

<div class="panel h-full flex flex-col">
  <div class="panel-header">
    <span>批注列表</span>
    <span class="tag bg-parchment-200 text-ink-700 ml-auto">
      {scheme?.annotations.length || 0} 条
    </span>
  </div>
  <div class="flex-1 overflow-y-auto scrollbar-thin p-2">
    {#if !scheme || scheme.annotations.length === 0}
      <div class="text-center py-8 text-ink-500 text-sm">
        <div class="text-4xl mb-2">📝</div>
        <div>暂无批注</div>
        <div class="text-xs mt-1">在工具栏选择批注工具后点击碎片</div>
      </div>
    {:else}
      <div class="space-y-2">
        {#each scheme.annotations as a (a.id)}
          <div
            class="rounded-lg border p-2 transition-all cursor-pointer"
            class:border-parchment-500={selectedAnnotationId === a.id || editingId === a.id}
            class:bg-parchment-200={selectedAnnotationId === a.id || editingId === a.id}
            class:border-parchment-200={selectedAnnotationId !== a.id && editingId !== a.id}
            class:bg-parchment-50={selectedAnnotationId !== a.id && editingId !== a.id}
            on:click={() => editingId !== a.id && dispatch('select', a.id)}
          >
            {#if editingId === a.id}
              <div class="space-y-2">
                <div>
                  <label class="label text-xs">名称</label>
                  <input class="input text-sm" bind:value={editLabel} />
                </div>
                <div>
                  <label class="label text-xs">颜色</label>
                  <div class="flex gap-1 flex-wrap">
                    {#each SYSTEM_CONFIG.ANNOTATION_COLORS as c}
                      <button
                        class="w-6 h-6 rounded border-2 transition-all"
                        style="background: {c}"
                        class:border-ink-400={editColor === c}
                        class:border-transparent={editColor !== c}
                        on:click={() => (editColor = c)}
                      ></button>
                    {/each}
                  </div>
                </div>
                <div>
                  <label class="label text-xs">描述</label>
                  <textarea class="input text-sm min-h-[60px]" bind:value={editDescription}></textarea>
                </div>
                <div class="flex gap-1 justify-end">
                  <button class="btn btn-secondary text-xs" on:click|stopPropagation={cancelEdit}>取消</button>
                  <button class="btn btn-primary text-xs" on:click|stopPropagation={saveEdit}>保存</button>
                </div>
              </div>
            {:else}
              <div class="flex items-start gap-2">
                <div
                  class="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                  style="background: {a.color}"
                ></div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="tag bg-parchment-200 text-ink-700">{ANNOTATION_TYPE_LABELS[a.type]}</span>
                    <span class="text-sm font-medium text-ink-800 truncate" title={a.label}>{a.label}</span>
                  </div>
                  <div class="text-xs text-ink-500 mt-1">
                    所属碎片: {getFragmentName(a.fragmentId)}
                  </div>
                  {#if a.description}
                    <div class="text-xs text-ink-600 mt-1 truncate" title={a.description}>
                      {a.description}
                    </div>
                  {/if}
                </div>
                <div class="flex gap-1 flex-shrink-0">
                  <button
                    title="编辑"
                    class="p-1 rounded hover:bg-parchment-300 text-ink-600"
                    on:click|stopPropagation={() => startEdit(a)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    title="删除"
                    class="p-1 rounded hover:bg-red-200 text-red-600"
                    on:click|stopPropagation={() => deleteAnnotation(a.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
  </div>
</div>
