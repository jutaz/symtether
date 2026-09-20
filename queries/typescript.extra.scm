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

; `export const templates = { … } as const satisfies Record<…>` — the TS-only
; as/satisfies wrappers sit between the declarator and its initializer, so the
; JS value alternation never sees the object and the const goes missing.
; `var` is deliberately absent: nobody writes `var x = {} as const`.
(lexical_declaration
  (variable_declarator
    name: (identifier) @name
    value: [
      (as_expression)
      (satisfies_expression)
    ])) @definition.constant

; Members of an exported object literal behind those same wrappers. The JS
; query covers the unwrapped form; these three spell out each wrapper nesting
; rather than using a wildcard, because `(_ (object …))` also matches nested
; objects and would capture `tree.outer.inner`. The value alternation mirrors
; the JS one so function-valued pairs stay @definition.function upstream
; instead of merging a `constant` kind onto them.
(export_statement
  (lexical_declaration
    (variable_declarator
      value: (as_expression
        (object
          (pair
            key: (property_identifier) @name
            value: [
              (string)
              (template_string)
              (number)
              (true)
              (false)
              (null)
              (undefined)
              (array)
              (object)
              (new_expression)
              (call_expression)
              (binary_expression)
              (unary_expression)
              (member_expression)
              (identifier)
              (await_expression)
              (ternary_expression)
              (regex)
            ]) @definition.constant)))))

(export_statement
  (lexical_declaration
    (variable_declarator
      value: (satisfies_expression
        (object
          (pair
            key: (property_identifier) @name
            value: [
              (string)
              (template_string)
              (number)
              (true)
              (false)
              (null)
              (undefined)
              (array)
              (object)
              (new_expression)
              (call_expression)
              (binary_expression)
              (unary_expression)
              (member_expression)
              (identifier)
              (await_expression)
              (ternary_expression)
              (regex)
            ]) @definition.constant)))))

(export_statement
  (lexical_declaration
    (variable_declarator
      value: (satisfies_expression
        (as_expression
          (object
            (pair
              key: (property_identifier) @name
              value: [
                (string)
                (template_string)
                (number)
                (true)
                (false)
                (null)
                (undefined)
                (array)
                (object)
                (new_expression)
                (call_expression)
                (binary_expression)
                (unary_expression)
                (member_expression)
                (identifier)
                (await_expression)
                (ternary_expression)
                (regex)
              ]) @definition.constant))))))

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
