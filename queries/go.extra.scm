; symtether supplement to the upstream Go tags.scm (which only captures
; functions, methods, and types).

; Method receivers: `func (s *Server) Start()` — @receiver makes the chain
; [Server, Start] so `Server.Start` suffix-matches per SPEC §5.2. The
; resolver dedupes against the upstream capture of the same method by byte
; range, preferring the chain with the receiver.
(method_declaration
  receiver: (parameter_list
    (parameter_declaration
      type: [
        (pointer_type (type_identifier) @receiver)
        (type_identifier) @receiver
      ]))
  name: (field_identifier) @name) @definition.method

(const_declaration
  (const_spec
    name: (identifier) @name)) @definition.constant

(var_declaration
  (var_spec
    name: (identifier) @name)) @definition.constant

; Struct fields: type Config struct { Timeout int }
(field_declaration
  name: (field_identifier) @name) @definition.field
