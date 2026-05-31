import type { Diff, DiffEntry, MetadataReport } from "./types.js";

export function diff(before: MetadataReport, after: MetadataReport): Diff {
  const entries: DiffEntry[] = [];
  const allPaths = new Set<string>();

  const beforeFlat = flattenReport(before);
  const afterFlat = flattenReport(after);

  for (const p of Object.keys(beforeFlat)) allPaths.add(p);
  for (const p of Object.keys(afterFlat)) allPaths.add(p);

  for (const path of [...allPaths].sort()) {
    const b = beforeFlat[path];
    const a = afterFlat[path];
    if (b !== undefined && a === undefined) {
      entries.push({ path, before: b, after: undefined, status: "removed" });
    } else if (b === undefined && a !== undefined) {
      entries.push({ path, before: undefined, after: a, status: "added" });
    } else if (JSON.stringify(b) !== JSON.stringify(a)) {
      entries.push({ path, before: b, after: a, status: "changed" });
    } else {
      entries.push({ path, before: b, after: a, status: "unchanged" });
    }
  }

  return { entries };
}

function flattenReport(report: MetadataReport): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const block of report.blocks) {
    for (const [field, value] of Object.entries(block.fields)) {
      flat[`${block.namespace}.${field}`] = value;
    }
  }
  return flat;
}
