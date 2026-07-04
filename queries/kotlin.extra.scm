; Full tags query for Kotlin — the upstream package ships no tags.scm, so
; unlike other languages this is the whole query, not a supplement.
; class_declaration covers classes, data classes, interfaces, and enum
; classes in this grammar.

(class_declaration
  (identifier) @name) @definition.class

(object_declaration
  (identifier) @name) @definition.class

(companion_object
  (identifier) @name) @definition.class

(function_declaration
  name: (identifier) @name) @definition.function

(property_declaration
  (variable_declaration
    (identifier) @name)) @definition.constant

(type_alias
  (identifier) @name) @definition.type

(enum_entry
  (identifier) @name) @definition.constant
