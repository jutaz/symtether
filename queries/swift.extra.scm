; Full tags query for Swift — replaces the upstream tags.scm, whose member
; patterns capture the ENTIRE class node as @definition.method. symtether
; builds nesting chains from byte-range containment, so each definition
; capture must be the member's own node, not its enclosing type.
; class_declaration covers classes, structs, enums, and extensions in this
; grammar.

(class_declaration
  name: (type_identifier) @name) @definition.class

(protocol_declaration
  name: (type_identifier) @name) @definition.interface

(function_declaration
  name: (simple_identifier) @name) @definition.function

(protocol_function_declaration
  name: (simple_identifier) @name) @definition.function

(init_declaration
  "init" @name) @definition.method

(property_declaration
  (pattern
    (simple_identifier) @name)) @definition.constant

(typealias_declaration
  name: (type_identifier) @name) @definition.type

(enum_entry
  name: (simple_identifier) @name) @definition.constant
