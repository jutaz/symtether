; symtether supplement to the upstream C tags.scm.

(enum_specifier
  name: (type_identifier) @name) @definition.enum

(enumerator
  name: (identifier) @name) @definition.constant

(preproc_def
  name: (identifier) @name) @definition.constant

(field_declaration
  declarator: (field_identifier) @name) @definition.field
