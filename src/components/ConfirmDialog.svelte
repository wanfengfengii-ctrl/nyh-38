<script lang="ts">
  export let title: string;
  export let open: boolean = false;
  export let confirmText: string = '确认';
  export let cancelText: string = '取消';
  export let confirmDisabled: boolean = false;
  export let danger: boolean = false;
  let dispatch = createEventDispatcher<{
    confirm: void;
    cancel: void;
  }>();
  import { createEventDispatcher } from 'svelte';
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" on:click={() => dispatch('cancel')}></div>
    <div class="relative panel w-full max-w-md mx-4 shadow-xl animate-in fade-in zoom-in duration-200">
      <div class="panel-header justify-between">
        <span>{title}</span>
        <button class="text-ink-500 hover:text-ink-700 p-1" on:click={() => dispatch('cancel')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="panel-body">
        <slot></slot>
      </div>
      <div class="px-4 py-3 border-t border-parchment-200 flex justify-end gap-2">
        <button class="btn btn-secondary" on:click={() => dispatch('cancel')}>{cancelText}</button>
        <button
          class={danger ? 'btn btn-danger' : 'btn btn-primary'}
          disabled={confirmDisabled}
          on:click={() => dispatch('confirm')}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}
