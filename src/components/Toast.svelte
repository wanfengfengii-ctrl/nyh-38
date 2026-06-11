<script lang="ts">
  export let type: 'info' | 'success' | 'warning' | 'error' = 'info';
  export let message: string = '';
  export let visible: boolean = false;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  $: if (visible) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      visible = false;
    }, 3000);
  }
  const colors: Record<string, string> = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };
</script>

{#if visible}
  <div class="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-300">
    <div class="{colors[type]} text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium">
      {message}
    </div>
  </div>
{/if}
