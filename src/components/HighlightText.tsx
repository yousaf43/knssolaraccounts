import { Fragment, ReactNode } from "react";
import { tokenize } from "@/lib/search";

type Props = {
  text: string | number | null | undefined;
  query: string;
  className?: string;
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Renders `text` with case-insensitive occurrences of every word in `query`
 * wrapped in a <mark> element so search matches are visually highlighted.
 * Supports multi-word queries ("lith 100" highlights both parts).
 */
export function HighlightText({ text, query, className }: Props) {
  const value = text === null || text === undefined ? "" : String(text);
  const tokens = tokenize(query);
  if (tokens.length === 0 || !value) return <>{value}</> as unknown as ReactNode;

  // Longest first so overlapping tokens highlight the widest match.
  const pattern = tokens
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegex)
    .join("|");

  let parts: string[];
  try {
    parts = value.split(new RegExp(`(${pattern})`, "gi"));
  } catch {
    return <>{value}</> as unknown as ReactNode;
  }

  const markClass =
    className ?? "bg-yellow-200 dark:bg-yellow-500/40 text-foreground rounded px-0.5";

  return (
    <>
      {parts.map((part, i) => {
        const lower = part.toLowerCase();
        const isMatch = part.length > 0 && tokens.some((t) => t === lower);
        return isMatch ? (
          <mark key={i} className={markClass}>
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        );
      })}
    </>
  );
}
