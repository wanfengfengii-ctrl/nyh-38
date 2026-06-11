<script lang="ts">
  import { onDestroy, createEventDispatcher } from 'svelte';
  import type { AssemblyScheme } from '@/types';
  import { appStore, statistics } from '@/lib/store';
  import { ANNOTATION_TYPE_LABELS } from '@/types';

  export let schemes: AssemblyScheme[] = [];
  export let currentSchemeId: string | null = null;
  const dispatch = createEventDispatcher<{
    create: void;
    rename: string;
    duplicate: string;
    delete: string;
    export: string;
    import: void;
  }>();

  let statsData: typeof statistics.T | undefined = undefined;
  const unsub = statistics.subscribe((v) => (statsData = v));
  onDestroy(() => unsub());

  let newSchemeName = '';
  let showNewInput = false;
  let renamingId: string | null = null;
  let renameValue = '';

  function createScheme() {
    if (!newSchemeName.trim()) return;
    appStore.createScheme(newSchemeName.trim());
    newSchemeName = '';
    showNewInput = false;
  }

  function startRename(s: AssemblyScheme) {
    renamingId = s.id;
    renameValue = s.name;
  }

  function saveRename() {
    if (renamingId && renameValue.trim()) {
      appStore.renameScheme(renamingId, renameValue.trim());
    }
    renamingId = null;
  }

  function switchScheme(id: string) {
    appStore.switchScheme(id);
  }

  function duplicate(id: string) {
    appStore.duplicateScheme(id);
  }

  function deleteScheme(id: string) {
    if (confirm('确定要删除此方案吗？')) {
      appStore.deleteScheme(id);
    }
  }

  function exportScheme(id: string) {
    const json = appStore.exportScheme(id);
    if (!json) return;
    const scheme = schemes.find((s) => s.id === id);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scheme?.name || 'scheme'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function triggerImport() {
    dispatch('import');
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
    <span>拼接方案</span>
    <div class="flex gap-1 ml-auto">
      <button class="btn btn-secondary text-xs" title="导入方案" on:click={triggerImport}>
        📥 导入
      </button>
      <button
        class="btn btn-primary text-xs"
        on:click={() => (showNewInput = !showNewInput)}
      >
        {showNewInput ? '取消' : '＋ 新建'}
      </button>
    </div>
  </div>
  {#if showNewInput}
    <div class="p-2 border-b border-parchment-200 bg-parchment-100">
      <div class="flex gap-1">
        <input
          class="input text-sm flex-1"
          placeholder="输入方案名称"
          bind:value={newSchemeName}
          on:keydown={(e) => e.key === 'Enter' && createScheme()}
        />
        <button class="btn btn-primary text-xs" disabled={!newSchemeName.trim()} on:click={createScheme}>
          创建
        </button>
      </div>
    </div>
  {/if}
  <div class="flex-1 overflow-y-auto scrollbar-thin p-2">
    <div class="space-y-1.5">
      {#each schemes as s (s.id)}
        <div
          class="rounded-lg border p-2 transition-all cursor-pointer"
          class:border-parchment-600={s.id === currentSchemeId}
          class:bg-parchment-200={s.id === currentSchemeId}
          class:border-parchment-200={s.id !== currentSchemeId}
          class:bg-parchment-50={s.id !== currentSchemeId}
          on:click={() => renamingId !== s.id && switchScheme(s.id)}
        >
          {#if renamingId === s.id}
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
                <div class="flex items-center gap-1.5">
                  {#if s.id === currentSchemeId}
                    <span class="tag bg-parchment-600 text-white">当前</span>
                  {/if}
                  <span class="font-medium text-ink-800 text-sm truncate">{s.name}</span>
                </div>
                <div class="text-xs text-ink-500 mt-1 space-x-2">
                  <span>碎片: {s.fragments.length}</span>
                  <span>批注: {s.annotations.length}</span>
                </div>
                <div class="text-xs text-ink-400 mt-0.5">
                  更新: {formatDate(s.updatedAt)}
                </div>
              </div>
              <div class="flex flex-col gap-0.5">
                <button
                  title="重命名"
                  class="p-1 rounded hover:bg-parchment-300 text-ink-600"
                  on:click|stopPropagation={() => startRename(s)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button
                  title="复制方案"
                  class="p-1 rounded hover:bg-parchment-300 text-ink-600"
                  on:click|stopPropagation={() => duplicate(s.id)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
                <button
                  title="导出"
                  class="p-1 rounded hover:bg-parchment-300 text-ink-600"
                  on:click|stopPropagation={() => exportScheme(s.id)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </button>
                <button
                  title="删除"
                  class="p-1 rounded hover:bg-red-200 text-red-600"
                  disabled={schemes.length <= 1}
                  on:click|stopPropagation={() => deleteScheme(s.id)}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
  </div>
  {#if currentSchemeId && statsData}
    <div class="p-2 border-t border-parchment-200 bg-parchment-100">
      <div class="grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <div class="font-semibold text-ink-800">{statsData.totalFragments}</div>
          <div class="text-ink-500">总碎片</div>
        </div>
        <div>
          <div class="font-semibold text-green-700">{statsData.matchedFragments}</div>
          <div class="text-ink-500">已拼接</div>
        </div>
        <div>
          <div class="font-semibold text-orange-700">{statsData.unmatchedFragments}</div>
          <div class="text-ink-500">未匹配</div>
        </div>
      </div>
    </div>
  {/if}
</div>
