import type { Diff } from "@exifscrub/core";

export default function DiffView({ diff }: { diff: Diff }) {
  const changed = diff.entries.filter((e) => e.status !== "unchanged");
  if (changed.length === 0) {
    return <p style={{ fontSize: "0.85rem", color: "var(--muted)" }}>No metadata changes.</p>;
  }

  return (
    <div className="diff-table-wrap" style={{ overflowX: "auto", marginTop: "0.5rem" }}>
      <table className="diff-table" style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
            <th style={{ padding: "0.35rem" }}>Field</th>
            <th style={{ padding: "0.35rem" }}>Status</th>
            <th style={{ padding: "0.35rem" }}>Before</th>
            <th style={{ padding: "0.35rem" }}>After</th>
          </tr>
        </thead>
        <tbody>
          {changed.map((entry) => (
            <tr key={entry.path} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.35rem", fontFamily: "monospace" }}>{entry.path}</td>
              <td style={{ padding: "0.35rem" }}>
                <span
                  style={{
                    color:
                      entry.status === "removed"
                        ? "#dc2626"
                        : entry.status === "added"
                          ? "#059669"
                          : "#d97706",
                  }}
                >
                  {entry.status}
                </span>
              </td>
              <td style={{ padding: "0.35rem", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                {formatVal(entry.before)}
              </td>
              <td style={{ padding: "0.35rem", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                {formatVal(entry.after)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatVal(v: unknown): string {
  if (v === undefined || v === null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
