export function makeThing() {
  return {};
}

// JS object members must be captured by the JS query, not a TS-only one.
export const legacy = {
  createThing: makeThing(),
  onReady: () => {},
};
