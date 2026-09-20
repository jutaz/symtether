# Actions

Resolvable — exported object members, dotted and bare:

- [imports.createImportLink](../src/actions.ts#sym:imports.createImportLink)
- [createImportLink](../src/actions.ts#sym:createImportLink)
- [imports.listImports](../src/actions.ts#sym:imports.listImports)
- [templates const](../src/actions.ts#sym:templates)
- [templates.welcome member](../src/actions.ts#sym:templates.welcome)
- [config.retries member](../src/actions.ts#sym:config.retries)
- [config.onClick is a function](../src/actions.ts#sym:fn:config.onClick)
- [tree.top](../src/actions.ts#sym:tree.top)
- [tree.outer object member](../src/actions.ts#sym:tree.outer)
- [weird.plain](../src/actions.ts#sym:weird.plain)

Deliberately not definitions — broken:

- [non-exported member](../src/actions.ts#sym:internal.secret)
- [nested member](../src/actions.ts#sym:tree.outer.inner)
- [onClick is not a const](../src/actions.ts#sym:const:config.onClick)

Ambiguous — a pair key colliding with a top-level function:

- [foo](../src/actions.ts#sym:foo)
- [the function foo](../src/actions.ts#sym:fn:foo)
- [the cfg member foo](../src/actions.ts#sym:const:foo)
