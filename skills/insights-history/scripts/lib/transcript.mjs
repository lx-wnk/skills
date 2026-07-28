const EXTENSION_LANGUAGES = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".py": "Python",
  ".rb": "Ruby",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".c": "C",
  ".h": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".hpp": "C++",
  ".md": "Markdown",
  ".json": "JSON",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".sh": "Shell",
  ".css": "CSS",
  ".html": "HTML",
};

const ERROR_PATTERNS = [
  [["exit code"], "Command Failed"],
  [["rejected", "doesn't want"], "User Rejected"],
  [["string to replace not found", "no changes"], "Edit Failed"],
  [["modified since read"], "File Changed"],
  [["exceeds maximum", "too large"], "File Too Large"],
  [["file not found", "does not exist"], "File Not Found"],
];

export function classifyToolError(text) {
  const haystack = String(text ?? "").toLowerCase();
  for (const [needles, label] of ERROR_PATTERNS) {
    if (needles.some((n) => haystack.includes(n))) return label;
  }
  return "Other";
}

export function isUserMessage(line) {
  if (line?.type !== "user" || line.isSidechain) return false;
  const content = line.message?.content;
  if (typeof content === "string") return true;
  if (Array.isArray(content)) {
    return !content.some((block) => block?.type === "tool_result");
  }
  return false;
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block?.type === "text")
    .map((block) => block.text ?? "")
    .join(" ");
}

function languageOf(input) {
  const filePath = input?.file_path ?? input?.notebook_path;
  if (typeof filePath !== "string") return null;
  const dot = filePath.lastIndexOf(".");
  if (dot < 0) return null;
  return EXTENSION_LANGUAGES[filePath.slice(dot).toLowerCase()] ?? null;
}

export function extractMeta(lines, { sessionId, projectPath, transcriptMtime }) {
  const meta = {
    session_id: sessionId,
    transcript_mtime: transcriptMtime,
    project_path: projectPath,
    start_time: "",
    duration_minutes: 0,
    user_message_count: 0,
    assistant_message_count: 0,
    tool_counts: {},
    languages: {},
    git_commits: 0,
    git_pushes: 0,
    input_tokens: 0,
    output_tokens: 0,
    first_prompt: "",
    user_interruptions: 0,
    user_response_times: [],
    tool_errors: 0,
    tool_error_categories: {},
    uses_task_agent: false,
    uses_mcp: false,
    uses_web_search: false,
    uses_web_fetch: false,
    lines_added: 0,
    lines_removed: 0,
    files_modified: 0,
    message_hours: [],
    user_message_timestamps: [],
  };

  const stamps = [];
  let lastAssistantAt = null;

  for (const line of lines) {
    const at = line?.timestamp ? new Date(line.timestamp) : null;
    if (at && !Number.isNaN(at.getTime())) stamps.push(at);

    if (isUserMessage(line)) {
      meta.user_message_count += 1;
      const text = textOf(line.message.content);
      if (!meta.first_prompt) meta.first_prompt = text.slice(0, 200);
      if (at) {
        meta.user_message_timestamps.push(line.timestamp);
        meta.message_hours.push(at.getUTCHours());
        if (lastAssistantAt) {
          meta.user_response_times.push((at - lastAssistantAt) / 1000);
          lastAssistantAt = null;
        }
      }
      continue;
    }

    if (line?.type === "user" && Array.isArray(line.message?.content)) {
      for (const block of line.message.content) {
        if (block?.type !== "tool_result") continue;
        const body = typeof block.content === "string" ? block.content : JSON.stringify(block.content ?? "");
        if (!/error|failed|not found|rejected/i.test(body)) continue;
        meta.tool_errors += 1;
        const label = classifyToolError(body);
        meta.tool_error_categories[label] = (meta.tool_error_categories[label] ?? 0) + 1;
      }
      continue;
    }

    if (line?.type !== "assistant") continue;

    meta.assistant_message_count += 1;

    if (line.isSidechain) continue;

    if (at) lastAssistantAt = at;

    const usage = line.message?.usage;
    if (usage) {
      meta.input_tokens += usage.input_tokens ?? 0;
      meta.output_tokens += usage.output_tokens ?? 0;
    }

    for (const block of line.message?.content ?? []) {
      if (block?.type !== "tool_use") continue;
      const name = block.name ?? "unknown";
      meta.tool_counts[name] = (meta.tool_counts[name] ?? 0) + 1;

      if (name === "Agent" || name === "Task") meta.uses_task_agent = true;
      if (name.startsWith("mcp__")) meta.uses_mcp = true;
      if (name === "WebSearch") meta.uses_web_search = true;
      if (name === "WebFetch") meta.uses_web_fetch = true;

      const language = languageOf(block.input);
      if (language) {
        meta.languages[language] = (meta.languages[language] ?? 0) + 1;
        meta.files_modified += 1;
      }

      const command = block.input?.command;
      if (typeof command === "string") {
        if (/\bgit\s+commit\b/.test(command)) meta.git_commits += 1;
        if (/\bgit\s+push\b/.test(command)) meta.git_pushes += 1;
      }
    }
  }

  if (stamps.length > 0) {
    stamps.sort((a, b) => a - b);
    meta.start_time = stamps[0].toISOString();
    meta.duration_minutes = Math.round((stamps.at(-1) - stamps[0]) / 60000);
  }

  return meta;
}
