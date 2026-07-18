import { ReactNode } from "react";

type Props = {
  text: string | number | null | undefined;
  query: string;
  className?: string;
};

/**
 * Renders `text` with case-insensitive occurrences of `query` wrapped in a
 * <mark> element so search matches are visually highlighted.
 */
export function Highlight({ text, query, className }: Props) {
  const value = text === null || text === undefined ? "" : String(text);
  const q = query.trim();
  if (!q) return <>{value}</> as unknown as ReactNode;

  // Escape regex special chars in query
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = value.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            className={
              className ??
              "bg-yellow-200 dark:bg-yellow-500/40 text-foreground rounded px-0.5"
            }
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
