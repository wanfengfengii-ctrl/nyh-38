<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { AssemblyScheme, SpliceRelation } from '@/types';
  import { appStore, spliceRelations, spliceRelationGroups, statistics } from '@/lib/store';

  export let scheme: AssemblyScheme | null = null;
  export let selectedFragmentId: string | null = null;

  const dispatch = createEventDispatcher<{
    selectFragment: string;
  }>();

  $: relations = $spliceRelations;
  $: relationGroups = $spliceRelationGroups;
  $: stats = $statistics;
  let expandedGroups = new Set<string>();

  function toggleGroup(groupId: string) {
    if (expandedGroups.has(groupId)) {
      expandedGroups.delete(groupId);
    } else {
      expandedGroups.add(groupId);
    }
    expandedGroups = new Set(expandedGroups);
  }

  function selectFragment(id: string) {
    appStore.setSelectedFragment(id);
    dispatch('selectFragment', id);
  }

  function removeRelation(relation: SpliceRelation) {
    const result = appStore.removeSpliceRelation(relation.fromFragmentId, relation.toFragmentId);
    if (!result.success) {
      console.error(result.error);
    }
  }
</script>

<div class="panel h-full flex flex-col">
  <div class="panel-header">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="20" x2="18" y2="10"></line>
      <line x1="12" y1="20" x2="12" y2="4"></line>
      <line x1="6" y1="20" x2="6" y2="14"></line>
      <line x1="18" y1="10" x2="12" y2="10"></line>
      <line x1="12" y1="4" x2="6" y2="14"></line>
    </svg>
    <span>拼接关系</span>
  </div>

  <div class="flex-1 overflow-y-auto scrollbar-thin p-2">
    {#if !scheme || scheme.fragments.length === 0}
      <div class="text-center py-8 text-ink-500 text-sm">
        <div class="text-4xl mb-2">🔗</div>
        <div>暂无碎片</div>
        <div class="text-xs mt-1">导入碎片后可设置拼接关系</div>
      </div>
    {:else if relations.length === 0}
      <div class="text-center py-8 text-ink-500 text-sm">
        <div class="text-4xl mb-2">🔗</div>
        <div>暂无拼接关系</div>
        <div class="text-xs mt-1">在碎片列表中选择两个碎片并点击拼接按钮</div>
      </div>
    {:else}
      <div class="space-y-3">
        <div class="bg-parchment-100 rounded-lg p-3">
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="text-center">
              <div class="text-lg font-bold text-green-700">{stats.matchedFragments}</div>
              <div class="text-ink-600">已拼接碎片</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-orange-700">{stats.unmatchedFragments}</div>
              <div class="text-ink-600">未匹配碎片</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-parchment-700">{relationGroups.length}</div>
              <div class="text-ink-600">拼接组</div>
            </div>
            <div class="text-center">
              <div class="text-lg font-bold text-ink-700">{relations.length}</div>
              <div class="text-ink-600">连接关系</div>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-parchment-300">
            <div class="text-xs text-ink-600 mb-1">拼接完成度</div>
            <div class="w-full h-2 bg-parchment-200 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-parchment-500 to-parchment-700 rounded-full transition-all duration-300"
                style="width: {Math.min(100, stats.assembledPercentage)}%"
              ></div>
            </div>
            <div class="text-xs text-right text-ink-700 mt-1">{stats.assembledPercentage.toFixed(1)}%</div>
          </div>
        </div>

        {#each relationGroups as group (group.groupId)}
          <div class="border border-parchment-200 rounded-lg overflow-hidden">
            <div
              class="flex items-center justify-between px-3 py-2 bg-parchment-100 cursor-pointer hover:bg-parchment-200 transition-colors"
              on:click={() => toggleGroup(group.groupId)}
            >
              <div class="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                  style="transform: {expandedGroups.has(group.groupId) ? 'rotate(90deg)' : 'rotate(0)'}; transition: transform 0.2s;">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                <span class="text-sm font-medium text-ink-800">
                  拼接组 {relationGroups.indexOf(group) + 1}
                </span>
                <span class="tag bg-green-100 text-green-700 text-xs">
                  {group.fragments.length} 碎片
                </span>
              </div>
              <span class="text-xs text-ink-500">
                {group.relations.length} 连接
              </span>
            </div>

            {#if expandedGroups.has(group.groupId)}
              <div class="p-2 space-y-2 bg-white">
                <div class="text-xs text-ink-600 font-medium mb-1">组内碎片：</div>
                <div class="flex flex-wrap gap-1">
                  {#each group.fragments as frag (frag.id)}
                    <span
                      class="tag text-xs cursor-pointer transition-all"
                      class:bg-parchment-200={selectedFragmentId !== frag.id}
                      class:text-ink-700={selectedFragmentId !== frag.id}
                      class:bg-parchment-500={selectedFragmentId === frag.id}
                      class:text-white={selectedFragmentId === frag.id}
                      class:opacity-50={!frag.visible}
                      on:click={() => selectFragment(frag.id)}
                      title={frag.visible ? frag.name : `${frag.name} (已隐藏)`}
                    >
                      {frag.name}
                      {#if !frag.visible}
                        <span class="ml-1">👁‍🗨</span>
                      {/if}
                    </span>
                  {/each}
                </div>

                <div class="text-xs text-ink-600 font-medium mt-2 mb-1">连接关系：</div>
                <div class="space-y-1">
                  {#each group.relations as rel (rel.id)}
                    <div
                      class="flex items-center justify-between text-xs bg-parchment-50 rounded px-2 py-1.5"
                      class:ring-2={selectedFragmentId === rel.fromFragmentId || selectedFragmentId === rel.toFragmentId}
                      class:ring-parchment-400={selectedFragmentId === rel.fromFragmentId || selectedFragmentId === rel.toFragmentId}
                    >
                      <div class="flex items-center gap-1 flex-1 min-w-0">
                        <span
                          class="font-medium truncate cursor-pointer hover:text-parchment-700"
                          on:click={() => selectFragment(rel.fromFragmentId)}
                          class:text-parchment-600={selectedFragmentId === rel.fromFragmentId}
                        >
                          {rel.fromFragment.name}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-green-600 flex-shrink-0">
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                          <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                        <span
                          class="font-medium truncate cursor-pointer hover:text-parchment-700"
                          on:click={() => selectFragment(rel.toFragmentId)}
                          class:text-parchment-600={selectedFragmentId === rel.toFragmentId}
                        >
                          {rel.toFragment.name}
                        </span>
                      </div>
                      <button
                        class="p-1 rounded hover:bg-red-100 text-red-500 flex-shrink-0 ml-1"
                        title="移除拼接关系"
                        on:click={() => removeRelation(rel)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if scheme && scheme.fragments.filter(f => !f.visible).length > 0}
    <div class="p-2 border-t border-parchment-200 bg-parchment-50 text-xs text-ink-500">
      <span class="opacity-50">👁‍🗨</span> 标记的碎片已隐藏，不参与统计和可视化
    </div>
  {/if}
</div>
