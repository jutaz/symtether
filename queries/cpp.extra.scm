; symtether supplement to the upstream C++ tags.scm.

(namespace_definition
  name: (namespace_identifier) @name) @definition.module

(enum_specifier
  name: (type_identifier) @name) @definition.enum

(alias_declaration
  name: (type_identifier) @name) @definition.type

(declaration
  (type_qualifier)
  declarator: (init_declarator
    declarator: (identifier) @name)) @definition.constant

(field_declaration
  declarator: (field_identifier) @name) @definition.field
