<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { MapFragment, AssemblyScheme, Annotation } from '@/types';
  import { SYSTEM_CONFIG, ANNOTATION_TYPE_LABELS } from '@/types';
  import { appStore } from '@/lib/store';
  import { clamp, normalizeRotation, getAnnotationsByFragmentId } from '@/lib/utils';

  export let fragment: MapFragment | null = null;
  export let scheme: AssemblyScheme | null = null;
  const dispatch = createEventDispatcher();

  let localName = '';
  let localX = 0;
  let localY = 0;
  let localRotation = 0;
  let localScaleX = 1;
  let localScaleY = 1;
  let localOpacity = 1;

  $: if (fragment) {
    localName = fragment.name;
    localX = fragment.x;
    localY = fragment.y;
    localRotation = fragment.rotation;
    localScaleX = fragment.scaleX;
    localScaleY = fragment.scaleY;
    localOpacity = fragment.opacity;
  }

  function updateField(field: keyof MapFragment, value: number | string) {
    if (!fragment) return;
    appStore.updateFragment(fragment.id, { [field]: value } as Partial<MapFragment>);
  }

  function handleNameBlur() {
    if (!fragment) return;
    if (localName.trim() && localName !== fragment.name) {
      updateField('name', localName.trim());
    } else {
      localName = fragment.name;
    }
  }

  function resetTransform() {
    if (!fragment) return;
    appStore.updateFragment(fragment.id, {
      x: fragment.x,
      y: fragment.y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    });
  }

  function rotateBy(deg: number) {
    if (!fragment) return;
    const newRotation = normalizeRotation(
      fragment.rotation + deg,
      SYSTEM_CONFIG.MIN_ROTATION,
      SYSTEM_CONFIG.MAX_ROTATION
    );
    updateField('rotation', newRotation);
  }

  function scaleBy(factor: number) {
    if (!fragment) return;
    const newScale = clamp(fragment.scaleX * factor, SYSTEM_CONFIG.MIN_SCALE, SYSTEM_CONFIG.MAX_SCALE);
    appStore.updateFragment(fragment.id, { scaleX: newScale, scaleY: newScale });
  }

  function getAnnotationsCount(): Annotation[] {
    if (!scheme || !fragment) return [];
    return getAnnotationsByFragmentId(scheme.annotations, fragment.id);
  }
</script>

<div class="panel">
  <div class="panel-header">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
    <span>碎片属性</span>
  </div>
  {#if fragment}
    <div class="panel-body space-y-4">
      <div>
        <label class="label text-xs">名称</label>
        <input
          class="input text-sm"
          bind:value={localName}
          on:blur={handleNameBlur}
          on:keydown={(e) => e.key === 'Enter' && handleNameBlur()}
        />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="label text-xs">X 坐标</label>
          <input
            type="number"
            class="input text-sm"
            bind:value={localX}
            on:change={() => updateField('x', localX)}
          />
        </div>
        <div>
          <label class="label text-xs">Y 坐标</label>
          <input
            type="number"
            class="input text-sm"
            bind:value={localY}
            on:change={() => updateField('y', localY)}
          />
        </div>
      </div>

      <div>
        <div class="flex justify-between items-center mb-1">
          <label class="label text-xs mb-0">旋转角度</label>
          <div class="flex gap-1">
            <button class="btn btn-secondary text-xs py-0.5 px-2" on:click={() => rotateBy(-45)}>-45°</button>
            <button class="btn btn-secondary text-xs py-0.5 px-2" on:click={() => rotateBy(-15)}>-15°</button>
            <button class="btn btn-secondary text-xs py-0.5 px-2" on:click={() => rotateBy(15)}>+15°</button>
            <button class="btn btn-secondary text-xs py-0.5 px-2" on:click={() => rotateBy(45)}>+45°</button>
          </div>
        </div>
        <input
          type="range"
          min={SYSTEM_CONFIG.MIN_ROTATION}
          max={SYSTEM_CONFIG.MAX_ROTATION}
          step="0.1"
          bind:value={localRotation}
          on:input={() => updateField('rotation', localRotation)}
          class="w-full accent-parchment-600"
        />
        <div class="flex justify-between text-xs text-ink-500 mt-0.5">
          <span>{SYSTEM_CONFIG.MIN_ROTATION}°</span>
          <span class="font-medium text-ink-700">{Number(localRotation).toFixed(1)}°</span>
          <span>{SYSTEM_CONFIG.MAX_ROTATION}°</span>
        </div>
      </div>

      <div>
        <div class="flex justify-between items-center mb-1">
          <label class="label text-xs mb-0">缩放比例</label>
          <div class="flex gap-1">
            <button class="btn btn-secondary text-xs py-0.5 px-2" on:click={() => scaleBy(0.8)}>−</button>
            <button class="btn btn-secondary text-xs py-0.5 px-2" on:click={resetTransform}>100%</button>
            <button class="btn btn-secondary text-xs py-0.5 px-2" on:click={() => scaleBy(1.25)}>+</button>
          </div>
        </div>
        <input
          type="range"
          min={SYSTEM_CONFIG.MIN_SCALE}
          max={SYSTEM_CONFIG.MAX_SCALE}
          step="0.01"
          bind:value={localScaleX}
          on:input={() => appStore.updateFragment(fragment.id, { scaleX: localScaleX, scaleY: localScaleX })}
          class="w-full accent-parchment-600"
        />
        <div class="flex justify-between text-xs text-ink-500 mt-0.5">
          <span>{(SYSTEM_CONFIG.MIN_SCALE * 100).toFixed(0)}%</span>
          <span class="font-medium text-ink-700">{(Number(localScaleX) * 100).toFixed(0)}%</span>
          <span>{(SYSTEM_CONFIG.MAX_SCALE * 100).toFixed(0)}%</span>
        </div>
      </div>

      <div>
        <label class="label text-xs">不透明度</label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.01"
          bind:value={localOpacity}
          on:input={() => updateField('opacity', localOpacity)}
          class="w-full accent-parchment-600"
        />
        <div class="flex justify-between text-xs text-ink-500 mt-0.5">
          <span>10%</span>
          <span class="font-medium text-ink-700">{(Number(localOpacity) * 100).toFixed(0)}%</span>
          <span>100%</span>
        </div>
      </div>

      {#if getAnnotationsCount().length > 0}
        <div class="border-t border-parchment-200 pt-3">
          <div class="text-xs font-medium text-ink-700 mb-2">
            关联批注 ({getAnnotationsCount().length})
          </div>
          <div class="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
            {#each getAnnotationsCount() as a}
              <div class="text-xs bg-parchment-100 rounded px-2 py-1 flex items-center gap-1">
                <span
                  class="w-2 h-2 rounded-full"
                  style="background: {a.color}"
                ></span>
                <span class="tag bg-parchment-200 text-ink-700 text-[10px]">
                  {ANNOTATION_TYPE_LABELS[a.type]}
                </span>
                <span class="text-ink-700 truncate">{a.label}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="border-t border-parchment-200 pt-3 text-xs text-ink-500 space-y-1">
        <div class="flex justify-between">
          <span>原始尺寸</span>
          <span>{fragment.originalWidth} × {fragment.originalHeight}</span>
        </div>
        <div class="flex justify-between">
          <span>当前层级</span>
          <span>z-index: {fragment.zIndex}</span>
        </div>
        <div class="flex justify-between">
          <span>创建时间</span>
          <span>{new Date(fragment.createdAt).toLocaleDateString('zh-CN')}</span>
        </div>
      </div>
    </div>
  {:else}
    <div class="panel-body text-center py-6 text-ink-500 text-sm">
      <div class="text-3xl mb-2">🖼️</div>
      <div>选择画布上的碎片以编辑属性</div>
    </div>
  {/if}
</div>
