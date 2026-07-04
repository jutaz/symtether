; symtether supplement to the upstream Lua tags.scm.

; Methods with their table: `function Scheduler:add()` — @receiver puts
; Scheduler in the nesting chain so `Scheduler.add` suffix-matches
; (SPEC §5.2). Same for dot-style `function Scheduler.make()`.
(function_declaration
  name: (method_index_expression
    table: (identifier) @receiver
    method: (identifier) @name)) @definition.method

(function_declaration
  name: (dot_index_expression
    table: (identifier) @receiver
    field: (identifier) @name)) @definition.function
