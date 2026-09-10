type Tree = Record<string, unknown>;

function isTree(value: unknown): value is Tree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Накладывает словарь поверх базового: совпавшие ветки сливаются, листья
 * заменяются. Так сценарий ТРЦ меняет «учителя» на «охранника», не трогая
 * остальные тексты и ни одного вызова t() в коде.
 */
export function deepMerge<T extends Tree>(base: T, override: Tree): T {
  const out: Tree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] =
      isTree(current) && isTree(value) ? deepMerge(current, value) : value;
  }
  return out as T;
}
