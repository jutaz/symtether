; symtether supplement to the upstream Ruby tags.scm (which only captures
; classes, modules, and methods).

; CONSTANT = value assignments (module or class level).
(assignment
  left: (constant) @name) @definition.constant
