<script setup lang="ts">
// The #sym:tether logotype rendered as live text so it sits inside the
// hero <h1> semantically. Design system: # and : neon, sym foreground,
// tether muted — JetBrains Mono 800 with tight tracking.
</script>

<template>
  <span class="wordmark">
    <span class="glow">#</span><span class="fg">sym</span
    ><span class="glow">:</span><span class="muted">tether</span>
  </span>
</template>

<style scoped>
.wordmark {
  font-family: var(--font-mono);
  font-weight: 800;
  letter-spacing: -0.02em;
  /* Inherit hero H1 sizing — VitePress scales this responsively. */
  font-size: inherit;
  line-height: 1;
  white-space: nowrap;
  display: inline-block;

  /* Semantic slots, re-pointed per theme via :global overrides below. */
  --wm-glow: var(--green-neon);
  --wm-glow-shadow: 0 0 12px rgba(46, 239, 10, 0.35);
  --wm-fg: #fff;
  --wm-muted: var(--slate-400);
}
.glow {
  color: var(--wm-glow);
  text-shadow: var(--wm-glow-shadow);
}
.fg {
  color: var(--wm-fg);
}
.muted {
  color: var(--wm-muted);
}
</style>

<style>
/* Light-mode remap. The raw neon (--green-neon) is reserved for glow on
   dark surfaces per the design system; on white it fails contrast and
   reads garish. Drop # and : to --green-600 (the light-theme accent),
   sym to the dark ink, tether to the light-theme muted slate, and
   suppress the glow — halos on white read as blur, not signal. */
html:not(.dark) .wordmark {
  --wm-glow: var(--green-600);
  --wm-glow-shadow: none;
  --wm-fg: var(--ink-900);
  --wm-muted: #6e7686;
}
</style>
