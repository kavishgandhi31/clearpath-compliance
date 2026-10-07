const MAX_ID = 2_147_483_647;

// IDs are Postgres integer columns, which stop at 2147483647. Anything else can't match a row, so it's treated as not found.
export function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id >= 1 && id <= MAX_ID ? id : null;
}
