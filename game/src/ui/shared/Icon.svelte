<script lang="ts">
  let {
    src,
    alt = '',
    decorative = true,
    class: extra = '',
  }: {
    src: string;
    alt?: string;
    decorative?: boolean;
    class?: string;
  } = $props();
</script>

<img class={`icon-label ${extra}`.trim()} {src} {alt} aria-hidden={decorative ? 'true' : undefined} />
