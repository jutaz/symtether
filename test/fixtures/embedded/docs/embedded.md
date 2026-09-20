# Embedded-language coverage

Svelte (TypeScript script):

- [card method](../src/UserCard.svelte#sym:UserCard.render)
- [card class](../src/UserCard.svelte#sym:class:UserCard)
- [card factory](../src/UserCard.svelte#sym:fn:makeCard)
- [card limit](../src/UserCard.svelte#sym:const:MAX_CARDS)

Svelte (module + plain-JS instance scripts):

- [module constant](../src/Counter.svelte#sym:const:increments)
- [counter method](../src/Counter.svelte#sym:Counter.reset)
- [increment function](../src/Counter.svelte#sym:fn:increment)

Astro (frontmatter and script tag):

- [widget method](../src/Widget.astro#sym:Widget.render)
- [widget factory](../src/Widget.astro#sym:fn:buildWidget)
- [client constant](../src/Widget.astro#sym:const:WIDGET_ID)
- [mount function](../src/Widget.astro#sym:fn:mountClient)

Broken (symbol absent from the script block):

- [never existed](../src/UserCard.svelte#sym:renderEverything)

Locator vs. script parse state:

- [survives broken markup](../src/BrokenMarkup.svelte#sym:fn:survivor)
- [missing in broken-markup file](../src/BrokenMarkup.svelte#sym:ghost)
- [broken script body](../src/SyntaxError.svelte#sym:oops)
