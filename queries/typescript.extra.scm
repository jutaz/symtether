; symtether supplement to the upstream TS tags.scm.

; namespace Foo { ... } — tree-sitter emits internal_module, which the
; upstream query misses entirely (it only matches legacy `module Foo {}`).
(internal_module
  name: (identifier) @name) @definition.module

; type Foo = ...
(type_alias_declaration
  name: (type_identifier) @name) @definition.type

; enum Color { ... }
(enum_declaration
  name: (identifier) @name) @definition.enum

; Enum members: enum Color { Red = 1 }
(enum_body
  (property_identifier) @name) @definition.constant
(enum_assignment
  name: (property_identifier) @name) @definition.constant

; Class fields: class Foo { handler = () => {}; limit = 5 }
(public_field_definition
  name: (property_identifier) @name
  value: [(arrow_function) (function_expression)]) @definition.method
(public_field_definition
  name: (property_identifier) @name
  value: [
    (string)
    (template_string)
    (number)
    (true)
    (false)
    (array)
    (object)
    (new_expression)
  ]) @definition.constant
