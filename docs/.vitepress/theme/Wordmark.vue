<script setup lang="ts">
// The #sym:tether logotype rendered as live text so it sits inside the
// hero <h1> semantically. Design system: # and : are neon, sym is
// foreground, and tether is muted. JetBrains Mono 800 with tight
// tracking. Glow uses the system's --glow-text-green token so it stays
// in sync with the source.
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
  font-weight: var(--fw-extra);
  letter-spacing: var(--ls-heading);
  font-size: inherit;
  line-height: var(--lh-tight);
  white-space: nowrap;
  display: inline-block;

  /* Semantic slots. Remapped for light mode below. */
  --wm-glow: var(--green-neon);
  --wm-glow-shadow: var(--glow-text-green);
  --wm-fg: var(--white);
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
/* Light-mode remap. Raw neon is reserved for glow on ink surfaces per
   the design system; on white it fails contrast. Drop # and : to
   --green-600 (light-theme accent), sym to ink-900, tether to the
   light-theme muted slate, glow off (halos on white read as blur). */
html:not(.dark) .wordmark {
  --wm-glow: var(--green-600);
  --wm-glow-shadow: none;
  --wm-fg: var(--ink-900);
  --wm-muted: #6e7686;
}
</style>
