# Fixable fixture

Moved file (mover.ts now lives in lib/):

- [helper](src/mover.ts#sym:relocatedHelper)

Renamed symbol (getDatum became getData, edit distance 2):

- [data access](lib/mover.ts#sym:getDatum)

Unfixable (no candidate anywhere):

- [vanished](lib/mover.ts#sym:completelyGoneSymbol)
