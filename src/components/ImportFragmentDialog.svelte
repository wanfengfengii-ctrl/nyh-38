<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import type { MapFragment } from '@/types';

  export let open: boolean = false;
  const dispatch = createEventDispatcher<{
    confirm: { name: string; imageSrc: string; originalWidth: number; originalHeight: number }[];
    cancel: void;
  }>();

  interface PendingFragment {
    file: File;
    name: string;
    imageSrc: string;
    originalWidth: number;
    originalHeight: number;
  }

  let pending: PendingFragment[] = [];
  let fileInput: HTMLInputElement | null = null;
  let loading = false;

  function triggerFileSelect() {
    fileInput?.click();
  }

  async function handleFiles(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files) return;
    loading = true;

    try {
      for (const file of Array.from(input.files)) {
        if (!file.type.startsWith('image/')) continue;
        try {
          const result = await processFile(file);
          const exists = pending.some((p) => p.name === result.name);
          if (!exists) {
            pending.push(result);
          }
        } catch (err) {
          console.error('文件加载失败', file.name, err);
        }
      }
    } finally {
      loading = false;
      if (fileInput) fileInput.value = '';
    }
  }

  function processFile(file: File): Promise<PendingFragment> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const baseName = file.name.replace(/\.[^.]+$/, '');
          resolve({
            file,
            name: baseName,
            imageSrc: src,
            originalWidth: img.naturalWidth,
            originalHeight: img.naturalHeight,
          });
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = src;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  }

  function removePending(idx: number) {
    pending.splice(idx, 1);
  }

  function confirmImport() {
    const data = pending.map((p) => ({
      name: p.name,
      imageSrc: p.imageSrc,
      originalWidth: p.originalWidth,
      originalHeight: p.originalHeight,
    }));
    dispatch('confirm', data);
    pending = [];
  }

  function cancelImport() {
    pending = [];
    dispatch('cancel');
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files) return;
    const fakeEvent = { target: { files } } as unknown as Event;
    handleFiles(fakeEvent);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function updateName(idx: number, name: string) {
    pending[idx].name = name;
  }

  function handleNameInput(idx: number, e: Event) {
    const target = e.target as HTMLInputElement;
    updateName(idx, target.value);
  }
</script>

<ConfirmDialog
  title="导入古地图碎片"
  open={open}
  confirmText={`导入 ${pending.length} 张`}
  confirmDisabled={pending.length === 0 || loading}
  on:confirm={confirmImport}
  on:cancel={cancelImport}
>
  <div class="space-y-4">
    <div
      class="border-2 border-dashed border-parchment-300 rounded-lg p-6 text-center cursor-pointer hover:border-parchment-500 hover:bg-parchment-50 transition-colors"
      on:click={triggerFileSelect}
      on:drop={handleDrop}
      on:dragover={handleDragOver}
    >
      <div class="text-4xl mb-2">🗺️</div>
      <div class="text-sm text-ink-700 font-medium">点击或拖拽图片到此处</div>
      <div class="text-xs text-ink-500 mt-1">支持 PNG、JPG、WebP 等格式，可多选</div>
      <input
        bind:this={fileInput}
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        on:change={handleFiles}
      />
    </div>

    {#if pending.length > 0}
      <div>
        <div class="text-xs font-medium text-ink-700 mb-2">待导入列表（{pending.length}）</div>
        <div class="space-y-2 max-h-48 overflow-y-auto scrollbar-thin border border-parchment-200 rounded-md p-2">
          {#each pending as p, idx}
            <div class="flex items-center gap-2 bg-parchment-50 rounded p-1.5">
              <img src={p.imageSrc} class="w-12 h-12 object-cover rounded border border-parchment-200" />
              <div class="flex-1 min-w-0">
                <input
                  class="input text-xs py-1"
                  value={p.name}
                  on:input={(e) => handleNameInput(idx, e)}
                />
                <div class="text-[10px] text-ink-500 mt-0.5">
                  {p.originalWidth}×{p.originalHeight} · {(p.file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <button
                class="p-1 rounded hover:bg-red-200 text-red-600"
                on:click={() => removePending(idx)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if loading}
      <div class="text-center text-sm text-ink-600">正在加载图片...</div>
    {/if}
  </div>
</ConfirmDialog>
