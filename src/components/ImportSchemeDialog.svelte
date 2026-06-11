<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { validateSchemeData, cloneScheme } from '@/lib/utils';

  export let open: boolean = false;
  const dispatch = createEventDispatcher<{
    confirm: string;
    cancel: void;
  }>();

  let fileName = '';
  let fileContent = '';
  let validationMsg = '';
  let isValid = false;
  let loading = false;
  let fileInput: HTMLInputElement | null = null;

  function triggerFileSelect() {
    fileInput?.click();
  }

  async function handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    loading = true;
    validationMsg = '';
    isValid = false;
    fileContent = '';

    try {
      fileName = file.name;
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!validateSchemeData(parsed)) {
        validationMsg = '❌ 方案格式无效：缺少必要字段或数据类型错误';
      } else {
        validationMsg = `✅ 方案有效：${parsed.name}（${parsed.fragments.length} 个碎片，${parsed.annotations.length} 条批注）`;
        isValid = true;
        fileContent = text;
      }
    } catch (err) {
      validationMsg = `❌ 文件解析失败：${(err as Error).message}`;
    } finally {
      loading = false;
      if (fileInput) fileInput.value = '';
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const fakeEvent = { target: { files: [file] } } as unknown as Event;
    handleFile(fakeEvent);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function confirmImport() {
    if (isValid && fileContent) {
      dispatch('confirm', fileContent);
      resetState();
    }
  }

  function cancelImport() {
    resetState();
    dispatch('cancel');
  }

  function resetState() {
    fileName = '';
    fileContent = '';
    validationMsg = '';
    isValid = false;
  }
</script>

<ConfirmDialog
  title="导入拼接方案"
  open={open}
  confirmText="导入方案"
  confirmDisabled={!isValid}
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
      <div class="text-4xl mb-2">📦</div>
      <div class="text-sm text-ink-700 font-medium">点击或拖拽 JSON 方案文件</div>
      <div class="text-xs text-ink-500 mt-1">导入无效方案不会覆盖当前工作区</div>
      <input
        bind:this={fileInput}
        type="file"
        accept=".json,application/json"
        class="hidden"
        on:change={handleFile}
      />
    </div>

    {#if fileName}
      <div class="text-sm text-ink-700">
        文件：<span class="font-medium">{fileName}</span>
      </div>
    {/if}

    {#if validationMsg}
      <div
        class="rounded-md px-3 py-2 text-sm"
        class:bg-green-50={isValid}
        class:text-green-700={isValid}
        class:bg-red-50={!isValid}
        class:text-red-700={!isValid}
      >
        {validationMsg}
      </div>
    {/if}

    {#if loading}
      <div class="text-center text-sm text-ink-600">正在验证文件...</div>
    {/if}

    {#if !isValid && validationMsg}
      <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-xs text-yellow-800">
        ⚠️ <strong>提示：</strong>由于方案文件无效，系统将保留当前工作区内容不变。请检查文件格式后重试。
      </div>
    {/if}
  </div>
</ConfirmDialog>
