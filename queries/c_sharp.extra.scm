; symtether supplement to the upstream C# tags.scm (which only captures
; classes, interfaces, methods, and namespaces).

(struct_declaration
  name: (identifier) @name) @definition.class

(enum_declaration
  name: (identifier) @name) @definition.enum

(enum_member_declaration
  name: (identifier) @name) @definition.constant

(record_declaration
  name: (identifier) @name) @definition.class

(property_declaration
  name: (identifier) @name) @definition.field

(field_declaration
  (variable_declaration
    (variable_declarator
      name: (identifier) @name))) @definition.field

(constructor_declaration
  name: (identifier) @name) @definition.method

(delegate_declaration
  name: (identifier) @name) @definition.type
