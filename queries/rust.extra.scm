; symtether supplement to the upstream Rust tags.scm.

; Methods with their impl type: `impl Parser { fn parse }` — @receiver puts
; Parser in the nesting chain so `Parser.parse` suffix-matches (SPEC §5.2).
(impl_item
  type: (type_identifier) @receiver
  body: (declaration_list
    (function_item
      name: (identifier) @name) @definition.method))

(const_item
  name: (identifier) @name) @definition.constant

(static_item
  name: (identifier) @name) @definition.constant

(type_item
  name: (type_identifier) @name) @definition.type

(enum_item
  name: (type_identifier) @name) @definition.enum

(enum_variant
  name: (identifier) @name) @definition.constant

; Struct fields: struct Config { timeout: u32 }
(field_declaration
  name: (field_identifier) @name) @definition.field
