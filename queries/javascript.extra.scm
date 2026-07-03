; symtether supplement to the upstream tags.scm — patterns GitHub's query
; misses but a #sym: ref plausibly points at.

; const/let/var declarations with non-function values (functions are already
; captured as @definition.function by the upstream query).
(lexical_declaration
  (variable_declarator
    name: (identifier) @name
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
    ])) @definition.constant

(variable_declaration
  (variable_declarator
    name: (identifier) @name
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
    ])) @definition.constant

; CommonJS exports: exports.FOO = ... / module.exports.FOO = ...
(assignment_expression
  left: (member_expression
    property: (property_identifier) @name)
  right: [
    (string)
    (template_string)
    (number)
    (true)
    (false)
    (null)
    (array)
    (object)
  ]) @definition.constant

; Private class methods: class Foo { #priv() {} }
(method_definition
  name: (private_property_identifier) @name) @definition.method
