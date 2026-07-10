import type { CreateProjectInput, CreateReferenceInput } from "@/lib/api/types";
import { splitCsv } from "@/lib/format";

export function parseProjectQuickLine(line: string): CreateProjectInput | null {
  const parts = line.split("|").map((item) => item.trim());
  if (parts.length < 2) return null;

  const gitValue = parts[2] as CreateProjectInput["git_status"] | undefined;
  const envValue = parts[3] as CreateProjectInput["env_type"] | undefined;
  const gitStatus: CreateProjectInput["git_status"] =
    gitValue === "Dirty" || gitValue === "Unpushed" || gitValue === "Clean" ? gitValue : "Clean";
  const envType: CreateProjectInput["env_type"] =
    envValue === "Conda" || envValue === "Docker" || envValue === "Venv" ? envValue : "Venv";

  return {
    name: parts[0],
    local_path: parts[1],
    git_status: gitStatus,
    env_type: envType,
    env_status: parts[4] ?? "",
    associated_paper_id: null,
  };
}

export function parseReferenceQuickLine(line: string): CreateReferenceInput | null {
  const parts = line.split("|").map((item) => item.trim());
  if (parts.length < 2) return null;

  const readValue = parts[3] as CreateReferenceInput["read_status"] | undefined;
  const readStatus: CreateReferenceInput["read_status"] =
    readValue === "Unread" || readValue === "Reading" || readValue === "Read" ? readValue : "Unread";

  return {
    title: parts[0],
    authors: splitCsv(parts[1]),
    tags: splitCsv(parts[2] ?? ""),
    read_status: readStatus,
    abstract_text: null,
    doi: null,
    arxiv_id: null,
  };
}

/**
 * Parse a BibTeX entry and extract reference fields.
 * Handles both { } and " " delimiters.
 */
export function parseBibtex(raw: string): Partial<CreateReferenceInput> {
  const get = (key: string): string | null => {
    // Match key = {value} or key = "value" (multi-line, case insensitive)
    const re = new RegExp(`\\b${key}\\s*=\\s*(?:[{"](.*?)[}"]|\\{([^}]*(?:\\{[^}]*\\}[^}]*)*)\\})`, "is");
    const m = re.exec(raw);
    const val = (m?.[1] ?? m?.[2] ?? "").trim().replace(/\s+/g, " ").replace(/[{}]/g, "");
    return val || null;
  };

  const rawAuthors = get("author") ?? "";
  const authors = rawAuthorToArray(rawAuthors);

  const title = get("title")?.replace(/[{}]/g, "") ?? "";
  const doi = get("doi");
  const arxivId = get("eprint") ?? get("arxivid");
  const abstract = get("abstract");
  const tags: string[] = [];

  // Extract year as a potential tag
  const year = get("year");
  if (year) tags.push(year);

  // Extract keywords
  const kw = get("keywords");
  if (kw) tags.push(...kw.split(/[,;]/).map((k) => k.trim()).filter(Boolean));

  return { title, authors, doi, arxiv_id: arxivId, abstract_text: abstract, tags, read_status: "Unread" };
}

function rawAuthorToArray(raw: string): string[] {
  if (!raw.trim()) return [];
  // BibTeX "and"-separated list; each entry may be "Last, First" or "First Last"
  return raw
    .split(/\s+and\s+/i)
    .map((a) => {
      const trimmed = a.trim().replace(/[{}]/g, "");
      if (!trimmed) return "";
      // "Last, First M." → "First M. Last"
      if (trimmed.includes(",")) {
        const [last, first] = trimmed.split(",").map((p) => p.trim());
        return first ? `${first} ${last}` : last;
      }
      return trimmed;
    })
    .filter(Boolean);
}
