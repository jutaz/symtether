export type Action = { handler: () => void };

declare function defineAction(config: { handler: () => void }): Action;
declare function compute(): number;

// Bare exported object literal: members nest under the const name.
export const imports = {
  createImportLink: defineAction({ handler: () => {} }),
  listImports: defineAction({ handler: () => {} }),
};

// `as const satisfies` wraps the initializer (TS-only node types).
export const templates = {
  welcome: { subject: 'hi' },
} as const satisfies Record<string, { subject: string }>;

// Plain `as const`.
export const config = {
  retries: 3,
  onClick: () => {},
} as const;

// Non-exported: members are implementation details, not definitions.
const internal = {
  secret: compute(),
};

// Nested object: only the top-level member is a definition.
export const tree = {
  outer: {
    inner: compute(),
  },
  top: compute(),
};

// String-literal and computed keys are not dotpath segments (SPEC §5.1).
export const weird = {
  'kebab-key': 1,
  [compute()]: 2,
  plain: 3,
};

// Collision: `foo` is both a top-level function and a member of cfg.
export function foo(): void {}
export const cfg = {
  foo: 1,
};
