; symtether supplement to the upstream Java tags.scm (which only captures
; classes, interfaces, and methods).

(field_declaration
  declarator: (variable_declarator
    name: (identifier) @name)) @definition.field

(enum_declaration
  name: (identifier) @name) @definition.enum

(enum_constant
  name: (identifier) @name) @definition.constant

(record_declaration
  name: (identifier) @name) @definition.class

(annotation_type_declaration
  name: (identifier) @name) @definition.interface
