# Guide

Valid refs:

- [fetch pattern](../src/client.ts#sym:ApiClient.fetchData)
- [config parsing](../src/client.ts#sym:fn:parseConfig)
- [retry helper](/src/client.ts#sym:withRetry)
- [skill type](../src/client.ts#sym:type:AgentSkill)
- [task runner](../src/tasks.py#sym:TaskRunner.run)
- [timeout constant](../src/tasks.py#sym:const:DEFAULT_TIMEOUT)
- [retry limit](../src/client.ts#sym:const:MAX_RETRIES)
- [url helper](../src/client.ts#sym:helpers.formatUrl)
- [recursive countdown](../src/client.ts#sym:fn:countdown)

Tier 2 (lexical):

- [deploy entry](../src/deploy.zsh#sym:main)

Broken:

- [gone file](../src/missing.ts#sym:Anything)
- [gone symbol](../src/client.ts#sym:ApiClient.fetchDatum)

Ambiguous (render exists on ApiClient and Widget):

- [renderer](../src/client.ts#sym:render)

Compat form (docref-style):

- [compat ref](../src/client.ts#ApiClient.fetchData)

Ignored — code fence:

```markdown
[example](../src/client.ts#sym:NotChecked.atAll)
```

Ignored — inline code span: `[x](../src/client.ts#sym:AlsoNotChecked)`.

Ignored — heading anchor on a markdown target: [other doc](./other.md#some-heading).

Ignored — external: [github](https://github.com/jutaz/symtether#sym:Nope).

<!-- symtether-disable-next-line -->
- [suppressed](../src/client.ts#sym:DoesNotExist)

Reference-style link: [ref style][fetch].

[fetch]: ../src/client.ts#sym:ApiClient.fetchAgentData
