; symtether supplement to the upstream Python tags.scm (which only captures
; module-level constants, classes, and functions).

; Class-level attributes: class Foo: BAR = 5
(class_definition
  body: (block
    (expression_statement
      (assignment
        left: (identifier) @name)) @definition.constant))
