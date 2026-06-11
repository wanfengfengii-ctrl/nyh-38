<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { validateSchemeImport } from '@/lib/utils';
  import type { ValidationResult } from '@/lib/utils';

  export let open: boolean = false;
  const dispatch = createEventDispatcher<{
    confirm: string;
    cancel: void;
  }>();

  let fileName = '';
  let fileContent = '';
  let validationResult: ValidationResult | null = null;
  let schemeInfo: { name: string; fragmentCount: number; annotationCount: number } | null = null;
  let loading = false;
  let fileInput: HTMLInputElement | null = null;

  $: isValid = validationResult?.success ?? false;

  function triggerFileSelect() {
    fileInput?.click();
  }

  async function handleFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    loading = true;
    validationResult = null;
    schemeInfo = null;
    fileContent = '';

    try {
      fileName = file.name;
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = validateSchemeImport(parsed);
      validationResult = result;

      if (parsed.name !== undefined && parsed.fragments !== undefined && parsed.annotations !== undefined) {
        schemeInfo = {
          name: parsed.name,
          fragmentCount: parsed.fragments.length,
          annotationCount: parsed.annotations.length,
        };
      }

      if (result.success) {
        fileContent = text;
      }
    } catch (err) {
      validationResult = {
        success: false,
        errors: [`文件解析失败：${(err as Error).message}`],
        warnings: [],
      };
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
    validationResult = null;
    schemeInfo = null;
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

    {#if schemeInfo && isValid}
      <div class="bg-green-50 border border-green-200 rounded-md px-3 py-2 text-sm text-green-700">
        ✅ 方案有效：<strong>{schemeInfo.name}</strong>（{schemeInfo.fragmentCount} 个碎片，{schemeInfo.annotationCount} 条批注）
      </div>
    {/if}

    {#if validationResult && validationResult.warnings.length > 0}
      <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3">
        <div class="text-sm font-medium text-yellow-800 mb-2">⚠️ 警告信息（{validationResult.warnings.length} 条）：</div>
        <ul class="text-xs text-yellow-700 space-y-1 max-h-32 overflow-y-auto">
          {#each validationResult.warnings as warning}
            <li>• {warning}</li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if validationResult && validationResult.errors.length > 0}
      <div class="bg-red-50 border border-red-200 rounded-md p-3">
        <div class="text-sm font-medium text-red-800 mb-2">❌ 校验错误（{validationResult.errors.length} 条）：</div>
        <ul class="text-xs text-red-700 space-y-1 max-h-40 overflow-y-auto">
          {#each validationResult.errors as error}
            <li>• {error}</li>
          {/each}
        </ul>
      </div>
    {/if}

    {#if loading}
      <div class="text-center text-sm text-ink-600">正在验证文件...</div>
    {/if}

    {#if !isValid && validationResult && validationResult.errors.length > 0}
      <div class="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-xs text-yellow-800">
        ⚠️ <strong>提示：</strong>由于方案文件无效，系统将保留当前工作区内容不变。请修正上述问题后重试。
      </div>
    {/if}
  </div>
</ConfirmDialog>
