import { useEffect, RefObject } from "react";

/**
 * Attaches click-to-sort behavior to every <th> inside every <table>
 * within the container. Sorts tbody rows in-place by cell content.
 * Auto-detects numeric, date, and text values. Preserves "Total"/"Grand Total"
 * summary rows at the bottom. Adds an arrow indicator to the active header.
 *
 * Cycle per column: none -> asc -> desc -> none.
 */
export function useSortableTables(
  containerRef: RefObject<HTMLElement>,
  deps: unknown[] = []
) {
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const cleanups: Array<() => void> = [];

    const isSummaryRow = (row: HTMLTableRowElement) => {
      const first = row.cells[0]?.textContent?.trim().toLowerCase() ?? "";
      if (!first) return false;
      return (
        first === "total" ||
        first === "totals" ||
        first === "grand total" ||
        first.startsWith("total ") ||
        first.startsWith("subtotal")
      );
    };

    const parseCell = (text: string): { n: number | null; d: number | null; s: string } => {
      const s = text.trim();
      if (!s || s === "—" || s === "-" || s === "∞") return { n: null, d: null, s: "" };
      // numeric: strip currency, commas, spaces, parens (negatives)
      const cleaned = s.replace(/[,\s]/g, "").replace(/[^0-9.\-()eE]/g, "");
      let numStr = cleaned;
      let neg = false;
      if (/^\(.*\)$/.test(cleaned)) { neg = true; numStr = cleaned.slice(1, -1); }
      if (numStr && /^-?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(numStr)) {
        const n = parseFloat(numStr) * (neg ? -1 : 1);
        if (Number.isFinite(n)) return { n, d: null, s };
      }
      // date
      const d = Date.parse(s);
      return { n: null, d: Number.isFinite(d) ? d : null, s };
    };

    const compareCells = (a: string, b: string) => {
      const pa = parseCell(a);
      const pb = parseCell(b);
      if (pa.n !== null && pb.n !== null) return pa.n - pb.n;
      if (pa.n !== null) return -1;
      if (pb.n !== null) return 1;
      if (pa.d !== null && pb.d !== null) return pa.d - pb.d;
      return pa.s.localeCompare(pb.s, undefined, { numeric: true, sensitivity: "base" });
    };

    const tables = Array.from(root.querySelectorAll("table"));
    tables.forEach((table) => {
      const thead = table.tHead;
      const tbody = table.tBodies[0];
      if (!thead || !tbody) return;
      const ths = Array.from(thead.querySelectorAll("th"));
      if (!ths.length) return;

      // Snapshot original order for third-click reset
      const originalOrder = Array.from(tbody.rows);

      // State per table
      const state: { col: number; dir: 0 | 1 | -1 } = { col: -1, dir: 0 };

      ths.forEach((th, idx) => {
        // Skip checkbox / action columns (contain no text and have input/button in header)
        const hasInteractive = th.querySelector("input,button");
        if (hasInteractive) return;
        if (!th.textContent?.trim()) return;

        th.style.cursor = "pointer";
        th.style.userSelect = "none";
        th.setAttribute("data-sortable", "true");

        const arrow = document.createElement("span");
        arrow.className = "sort-arrow";
        arrow.style.marginLeft = "4px";
        arrow.style.opacity = "0.35";
        arrow.style.fontSize = "0.75em";
        arrow.textContent = "⇅";
        th.appendChild(arrow);

        const onClick = () => {
          if (state.col !== idx) {
            state.col = idx;
            state.dir = 1;
          } else if (state.dir === 1) {
            state.dir = -1;
          } else if (state.dir === -1) {
            state.dir = 0;
          } else {
            state.dir = 1;
          }

          // Reset all arrows
          ths.forEach((h) => {
            const a = h.querySelector<HTMLSpanElement>(".sort-arrow");
            if (a) { a.textContent = "⇅"; a.style.opacity = "0.35"; }
          });

          const currentRows = Array.from(tbody.rows);
          const summaryRows = currentRows.filter(isSummaryRow);
          const dataRows = currentRows.filter((r) => !isSummaryRow(r));

          let sorted: HTMLTableRowElement[];
          if (state.dir === 0) {
            sorted = originalOrder.filter((r) => !isSummaryRow(r));
          } else {
            sorted = [...dataRows].sort((r1, r2) => {
              const t1 = r1.cells[idx]?.textContent ?? "";
              const t2 = r2.cells[idx]?.textContent ?? "";
              const cmp = compareCells(t1, t2);
              return state.dir === 1 ? cmp : -cmp;
            });
            arrow.textContent = state.dir === 1 ? "▲" : "▼";
            arrow.style.opacity = "1";
          }

          // Re-insert
          const frag = document.createDocumentFragment();
          sorted.forEach((r) => frag.appendChild(r));
          summaryRows.forEach((r) => frag.appendChild(r));
          tbody.appendChild(frag);

          // Re-index Sr # column after sort so it always stays 1,2,3...
          const firstHeader = ths[0]?.textContent?.trim().toLowerCase() ?? "";
          if (firstHeader.includes("sr") || firstHeader.includes("#")) {
            const dataRowsAfterSort = Array.from(tbody.rows).filter((r) => !isSummaryRow(r));
            dataRowsAfterSort.forEach((row, rowIdx) => {
              const srCell = row.cells[0];
              if (srCell) srCell.textContent = String(rowIdx + 1);
            });
          }
        };

        th.addEventListener("click", onClick);
        cleanups.push(() => {
          th.removeEventListener("click", onClick);
          arrow.remove();
          th.removeAttribute("data-sortable");
          th.style.cursor = "";
          th.style.userSelect = "";
        });
      });
    });

    return () => { cleanups.forEach((fn) => fn()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
