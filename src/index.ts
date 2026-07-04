/**
 * symtether library entry. `import { check } from 'symtether'`.
 * The CLI is a thin shell over these exports (§7).
 */
export { check } from './check.js';
export { fix, applyEdits } from './fix.js';
export { init, MANAGED_BLOCK, managedBlock } from './init.js';
export { update } from './update.js';
export {
  parseSumFile,
  formatSumFile,
  readSumFile,
  writeSumFile,
  sumKey,
  SUM_FILE,
} from './sumfile.js';
export { extractRefs } from './extract.js';
export { Resolver } from './resolve.js';
export { toJson, toHuman } from './report.js';
export { findRepoRoot, resolveTarget, toPosix } from './repo.js';
export type { SumEntry } from './sumfile.js';
export type { UpdateOptions, UpdateResult } from './update.js';
export type {
  CheckOptions,
  CheckReport,
  CheckSummary,
  Candidate,
  Definition,
  Ref,
  RefStatus,
  Resolution,
  SymbolKind,
  Tier,
} from './types.js';
export { UsageError } from './types.js';
export type { FixEdit, FixOptions, FixReport } from './fix.js';
export type { InitOptions, InitResult } from './init.js';
