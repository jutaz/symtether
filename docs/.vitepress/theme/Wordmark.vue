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
}
.glow {
  color: var(--green-neon);
  text-shadow: 0 0 12px rgba(46, 239, 10, 0.35);
}
.fg {
  color: #fff;
}
.muted {
  color: var(--slate-400);
}
</style>
