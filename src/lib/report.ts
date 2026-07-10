import type { AdvisorReportInput } from "@/lib/types/local";
import { WEEKLY_BOARD_LANES } from "@/lib/types/local";
import { formatDaysLeft } from "@/lib/format";
import { invoke } from "@tauri-apps/api/core";
import katex from "katex";

export function buildAdvisorWeeklyReport(input: AdvisorReportInput): string {
  const completedFocus = input.focusItems.filter((item) => item.done);
  const openFocus = input.focusItems.filter((item) => !item.done);
  const weeklyHours = input.snapshot.deep_work_minutes / 60;

  const boardSummary = WEEKLY_BOARD_LANES.map((lane) => {
    const count = input.weeklyBoardItems.filter((item) => item.lane === lane.id).length;
    return `- ${lane.label}: ${count}`;
  }).join("\n");

  const milestoneSummary = input.paperPlans
    .slice(0, 5)
    .map((plan) => {
      const done = plan.milestones.filter((item) => item.done).length;
      return `- ${plan.title}: ${done}/${plan.milestones.length} milestones complete`;
    })
    .join("\n");

  const watchlist = input.submissionWatchlist
    .map((item) => `- ${item.venue} | ${item.paper} | ${item.status} | ${formatDaysLeft(item.daysLeft)}`)
    .join("\n");

  return [
    `# Weekly Research Report`,
    ``,
    `Researcher: ${input.researcherName}`,
    `Generated: ${new Date(input.generatedAt).toLocaleString()}`,
    ``,
    `## Executive Summary`,
    `- Deep work this week: ${weeklyHours.toFixed(1)}h / ${input.weeklyTargetHours.toFixed(1)}h target`,
    `- Urgent deadlines (<=14 days): ${input.snapshot.urgent_deadlines}`,
    `- Active projects (48h): ${input.snapshot.active_projects}`,
    `- Unread papers (7d): ${input.snapshot.unread_papers}`,
    ``,
    `## Progress Snapshot`,
    `- Projects tracked: ${input.projects.length}`,
    `- References tracked: ${input.references.length}`,
    `- Venues tracked: ${input.venues.length}`,
    `- Submission trackers: ${input.submissions.length}`,
    ``,
    `## Focus Items Completed`,
    completedFocus.length > 0 ? completedFocus.map((item) => `- ${item.text}`).join("\n") : `- None completed yet`,
    ``,
    `## Focus Items Carrying Forward`,
    openFocus.length > 0 ? openFocus.map((item) => `- ${item.text}`).join("\n") : `- No carry-over items`,
    ``,
    `## Weekly Planning Board`,
    boardSummary,
    ``,
    `## Submission Risk Radar`,
    watchlist || `- No active submission risks`,
    ``,
    `## Paper Milestone Progress`,
    milestoneSummary || `- No milestone plans created`,
    ``,
    `## Next Week Priorities`,
    `- Finalize top 3 tasks from "Today" / "This Week" lanes`,
    `- Close at least one open milestone block`,
    `- Reduce active submission risk for nearest deadline`,
  ].join("\n");
}

export async function downloadText(fileName: string, content: string): Promise<void> {
  try {
    const savedPath = await invoke<string>("save_text_file", { filename: fileName, content });
    // savedPath is empty string if user cancelled
    return savedPath ? undefined : undefined;
  } catch {
    // fallback: blob download (browser/dev mode)
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

/**
 * Converts markdown with LaTeX ($$...$$, $...$) to HTML for in-app preview.
 */
export function markdownToHtml(md: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const renderLatex = (src: string, displayMode: boolean): string => {
    try {
      return katex.renderToString(src, { displayMode, throwOnError: false, output: "html" });
    } catch {
      return escape(src);
    }
  };

  // Process display math blocks $$...$$ first (can span a single line here)
  const processInline = (s: string): string =>
    escape(s)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.*?)`/g, '<code class="bg-muted px-0.5 rounded text-xs font-mono">$1</code>');

  const processWithLatex = (s: string): string => {
    // Inline math $...$
    let result = s.replace(/\$([^$\n]+?)\$/g, (_, expr) => renderLatex(expr, false));
    // Bold, code
    result = result
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+?)`/g, '<code class="bg-muted px-0.5 rounded text-xs font-mono">$1</code>');
    return result;
  };

  // Split on display math $$...$$ which we handle line by line
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  let inDisplayMath = false;
  let displayMathBuffer = "";

  for (const raw of lines) {
    const trimmed = raw.trim();

    if (trimmed === "$$") {
      if (!inDisplayMath) {
        if (inList) { html += "</ul>"; inList = false; }
        inDisplayMath = true;
        displayMathBuffer = "";
      } else {
        inDisplayMath = false;
        html += `<div class="my-2 overflow-x-auto">${renderLatex(displayMathBuffer, true)}</div>`;
        displayMathBuffer = "";
      }
      continue;
    }

    if (inDisplayMath) {
      displayMathBuffer += (displayMathBuffer ? "\n" : "") + trimmed;
      continue;
    }

    // Check for inline $$ on one line: $$expr$$
    if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length > 4) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<div class="my-2 overflow-x-auto">${renderLatex(trimmed.slice(2, -2), true)}</div>`;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h3 class="text-sm font-semibold mt-4 mb-1">${processWithLatex(trimmed.slice(4))}</h3>`;
    } else if (trimmed.startsWith("## ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h2 class="text-base font-bold mt-5 mb-1.5 border-b border-border pb-1">${processWithLatex(trimmed.slice(3))}</h2>`;
    } else if (trimmed.startsWith("# ")) {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<h1 class="text-lg font-bold mt-2 mb-3">${processWithLatex(trimmed.slice(2))}</h1>`;
    } else if (trimmed.startsWith("- ")) {
      if (!inList) { html += '<ul class="list-disc ml-5 space-y-0.5 mb-2">'; inList = true; }
      html += `<li class="text-sm">${processWithLatex(trimmed.slice(2))}</li>`;
    } else if (trimmed === "") {
      if (inList) { html += "</ul>"; inList = false; }
      html += "<br/>";
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p class="text-sm mb-1">${processWithLatex(trimmed)}</p>`;
    }
  }

  if (inList) html += "</ul>";
  return html;
}

export async function openPrintWindow(content: string, title: string): Promise<void> {
  const body = markdownToHtml(content);
  const html = `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>${title}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
    <style>
      body { font-family: system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #111; }
      h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
      h2 { font-size: 1.1rem; font-weight: 700; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 1.5rem; }
      h3 { font-size: 1rem; font-weight: 600; margin-top: 1rem; }
      ul { margin-left: 1.5rem; } li { margin-bottom: 2px; }
      code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 0.85em; }
      @media print { body { margin: 0; } }
    </style>
  </head><body>${body}<script>window.onload=function(){window.print();};<\/script></body></html>`;

  try {
    await invoke("open_html_for_print", { html });
  } catch {
    // fallback: window.open (dev mode)
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }
}
