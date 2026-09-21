# Embedded-language coverage

Svelte, TypeScript script — every construct the TS tags query captures:

- [interface](../src/UserCard.svelte#sym:type:CardProps)
- [type alias](../src/UserCard.svelte#sym:type:CardId)
- [enum](../src/UserCard.svelte#sym:type:CardState)
- [enum member](../src/UserCard.svelte#sym:CardState.Expanded)
- [zero-valued enum member](../src/UserCard.svelte#sym:CardState.Collapsed)
- [namespace](../src/UserCard.svelte#sym:type:cards)
- [namespace function](../src/UserCard.svelte#sym:cards.describe)
- [card class](../src/UserCard.svelte#sym:class:UserCard)
- [static field](../src/UserCard.svelte#sym:const:UserCard.VERSION)
- [instance field](../src/UserCard.svelte#sym:const:UserCard.limit)
- [arrow-function field](../src/UserCard.svelte#sym:fn:UserCard.onSelect)
- [accessor](../src/UserCard.svelte#sym:UserCard.state)
- [card method](../src/UserCard.svelte#sym:UserCard.render)
- [async method](../src/UserCard.svelte#sym:UserCard.load)
- [generator method](../src/UserCard.svelte#sym:UserCard.walk)
- [static method](../src/UserCard.svelte#sym:UserCard.create)
- [card factory](../src/UserCard.svelte#sym:fn:makeCard)
- [async function](../src/UserCard.svelte#sym:fn:fetchCard)
- [generator function](../src/UserCard.svelte#sym:fn:cardIds)
- [arrow const](../src/UserCard.svelte#sym:fn:buildCard)
- [object literal](../src/UserCard.svelte#sym:const:cardActions)
- [object member](../src/UserCard.svelte#sym:const:cardActions.open)
- [function-valued member](../src/UserCard.svelte#sym:fn:cardActions.close)
- [as const object](../src/UserCard.svelte#sym:const:CARD_DEFAULTS)
- [as const member](../src/UserCard.svelte#sym:const:CARD_DEFAULTS.theme)
- [card limit](../src/UserCard.svelte#sym:const:MAX_CARDS)

Svelte, module script plus a plain-JS instance script in the same file:

- [module constant](../src/Counter.svelte#sym:const:increments)
- [module function](../src/Counter.svelte#sym:fn:describeModule)
- [counter class](../src/Counter.svelte#sym:class:Counter)
- [plain-js static field](../src/Counter.svelte#sym:const:Counter.STEP)
- [plain-js field](../src/Counter.svelte#sym:const:Counter.total)
- [plain-js arrow field](../src/Counter.svelte#sym:fn:Counter.onTick)
- [counter method](../src/Counter.svelte#sym:Counter.reset)
- [plain-js async method](../src/Counter.svelte#sym:Counter.flush)
- [plain-js object literal](../src/Counter.svelte#sym:const:counterActions)
- [plain-js object member](../src/Counter.svelte#sym:const:counterActions.bump)
- [plain-js fn member](../src/Counter.svelte#sym:fn:counterActions.clear)
- [increment function](../src/Counter.svelte#sym:fn:increment)

Astro frontmatter — the same construct matrix:

- [frontmatter interface](../src/Widget.astro#sym:type:Props)
- [frontmatter type alias](../src/Widget.astro#sym:type:WidgetId)
- [frontmatter enum](../src/Widget.astro#sym:type:WidgetState)
- [frontmatter enum member](../src/Widget.astro#sym:WidgetState.Busy)
- [frontmatter zero enum member](../src/Widget.astro#sym:WidgetState.Idle)
- [frontmatter namespace](../src/Widget.astro#sym:type:widgets)
- [frontmatter namespace fn](../src/Widget.astro#sym:widgets.describe)
- [widget class](../src/Widget.astro#sym:class:Widget)
- [frontmatter static field](../src/Widget.astro#sym:const:Widget.VERSION)
- [frontmatter field](../src/Widget.astro#sym:const:Widget.size)
- [frontmatter arrow field](../src/Widget.astro#sym:fn:Widget.onTap)
- [frontmatter accessor](../src/Widget.astro#sym:Widget.state)
- [widget method](../src/Widget.astro#sym:Widget.render)
- [frontmatter async method](../src/Widget.astro#sym:Widget.hydrate)
- [frontmatter static method](../src/Widget.astro#sym:Widget.create)
- [widget factory](../src/Widget.astro#sym:fn:buildWidget)
- [frontmatter async fn](../src/Widget.astro#sym:fn:fetchWidget)
- [frontmatter generator](../src/Widget.astro#sym:fn:widgetIds)
- [frontmatter arrow const](../src/Widget.astro#sym:fn:makeWidget)
- [frontmatter object literal](../src/Widget.astro#sym:const:widgetActions)
- [frontmatter object member](../src/Widget.astro#sym:const:widgetActions.show)
- [frontmatter fn member](../src/Widget.astro#sym:fn:widgetActions.hide)
- [frontmatter as const object](../src/Widget.astro#sym:const:WIDGET_DEFAULTS)
- [frontmatter as const member](../src/Widget.astro#sym:const:WIDGET_DEFAULTS.theme)

Astro `<script>` tag, resolved independently of the frontmatter:

- [client constant](../src/Widget.astro#sym:const:WIDGET_ID)
- [client class](../src/Widget.astro#sym:class:ClientWidget)
- [client method](../src/Widget.astro#sym:ClientWidget.mount)
- [mount function](../src/Widget.astro#sym:fn:mountClient)

Broken (symbol absent from the script block):

- [never existed](../src/UserCard.svelte#sym:renderEverything)

Locator vs. script parse state:

- [survives broken markup](../src/BrokenMarkup.svelte#sym:fn:survivor)
- [missing in broken-markup file](../src/BrokenMarkup.svelte#sym:ghost)
- [broken script body](../src/SyntaxError.svelte#sym:oops)
