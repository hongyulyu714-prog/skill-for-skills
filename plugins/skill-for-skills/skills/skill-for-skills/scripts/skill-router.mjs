#!/usr/bin/env node

import {
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_FILES = 1_500;
const MAX_BYTES = 512 * 1024;
const CONFIG_DIR = path.join(os.homedir(), ".skill-router");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const SELF_NAMES = new Set(["skill-for-skills", "skill-for-skills:skill-for-skills"]);

const CAPABILITIES = [
  {
    id: "audit",
    label: "体验审查",
    task: /(?:ux|ui|体验|审核|审查|评审|可用性|无障碍|audit|critique|review|onboarding|checkout)/i,
    skill: /(?:\baudit\b|\bcritique\b|user experience|\bux\b|usability|accessibility|体验审查|可用性)/i,
    reason: "负责体验审查、问题分析与报告输出",
    hints: ["audit", "ux"],
  },
  {
    id: "browser",
    label: "浏览器操作",
    task: /(?:浏览器|网页|网站|页面|链接|网址|\burl\b|截图|点击|填写|browser|website|screenshot|navigate|playwright|chrome)/i,
    skill: /(?:control.*browser|browser automation|in-app browser|\bplaywright\b|\bchrome\b|navigate.*page|clicking.*page)/i,
    reason: "负责打开页面、完成交互与截图采集",
    hints: ["browser", "chrome"],
  },
  {
    id: "spreadsheet",
    label: "表格处理",
    task: /(?:表格|工作簿|\bexcel\b|\bxlsx?\b|\bcsv\b|\btsv\b|spreadsheet|workbook|google sheets?)/i,
    skill: /(?:spreadsheet|workbook|\bexcel\b|\bxlsx?\b|\bcsv\b|\btsv\b|google sheets?)/i,
    reason: "负责创建、分析并验证表格",
    hints: ["spreadsheet", "excel"],
  },
  {
    id: "presentation",
    label: "演示文稿",
    task: /(?:演示文稿|幻灯片|汇报材料|\bpptx?\b|powerpoint|presentation|slide deck|slides)/i,
    skill: /(?:presentation|powerpoint|\bpptx?\b|slide deck|google slides?)/i,
    reason: "负责生成、编辑并验证演示文稿",
    hints: ["presentation", "slides"],
  },
  {
    id: "document",
    label: "文档处理",
    task: /(?:文档|合同|公文|\bword\b|\bdocx\b|document|google docs?|redline)/i,
    skill: /(?:\bdocument\b|\bdocx\b|microsoft word|google docs?|redline)/i,
    reason: "负责创建、编辑并验证结构化文档",
    hints: ["document", "docx"],
  },
  {
    id: "pdf",
    label: "PDF 处理",
    task: /(?:\bpdf\b|合并pdf|拆分pdf|填写pdf|提取pdf)/i,
    skill: /(?:\bpdf\b|acroform|pypdf|pdfplumber|poppler)/i,
    reason: "负责读取、生成并验证 PDF",
    hints: ["pdf"],
  },
  {
    id: "database",
    label: "数据库查询",
    task: /(?:数据库|查库|查表|表结构|查询数据|跑sql|执行sql|\bsql\b|mysql|oracle|milvus|rds|database|query)/i,
    skill: /(?:数据库|\bdatabase\b|\bsql\b|mysql|oracle|milvus|rds|query.*table)/i,
    reason: "负责连接数据源、生成查询并返回结果",
    hints: ["db", "database", "query"],
  },
  {
    id: "design",
    label: "产品设计",
    task: /(?:产品设计|界面设计|交互设计|视觉稿|原型|落地页|设计系统|figma|figjam|design|prototype|wireframe|mockup)/i,
    skill: /(?:product design|interface design|visual design|\bfigma\b|\bfigjam\b|prototype|wireframe|mockup|design system)/i,
    reason: "负责设计探索、界面实现或设计系统工作",
    hints: ["design", "figma"],
  },
  {
    id: "image",
    label: "图像生成",
    task: /(?:生成图片|做图|生图|插画|海报|图片编辑|抠图|image generation|imagegen|illustration|poster)/i,
    skill: /(?:image generation|generate.*image|edit.*image|raster image|illustration|imagegen)/i,
    reason: "负责生成或编辑视觉图像",
    hints: ["image", "imagegen"],
  },
  {
    id: "code",
    label: "代码开发",
    task: /(?:写代码|开发|实现功能|修复bug|重构|代码审查|前端|后端|接口|脚本|coding|implement|debug|refactor|frontend|backend|api)/i,
    skill: /(?:code|coding|implementation|developer|frontend|backend|\bapi\b|debug|repository|codebase)/i,
    reason: "负责实现、修改或验证代码",
    hints: ["code", "implement", "developer"],
  },
  {
    id: "research",
    label: "研究分析",
    task: /(?:研究|调研|论文|文献|学术|arxiv|research|paper|literature|academic)/i,
    skill: /(?:research|paper|literature|academic|arxiv|论文|学术|研究)/i,
    reason: "负责检索、分析并总结研究材料",
    hints: ["research", "paper", "arxiv"],
  },
  {
    id: "writing",
    label: "写作润色",
    task: /(?:写作|撰写|改写|润色|翻译|摘要|周报|文案|polish|rewrite|translate|writing|summary)/i,
    skill: /(?:writing|polish|rewrite|translate|summary|润色|写作|改写|翻译|周报)/i,
    reason: "负责撰写、改写或润色内容",
    hints: ["writing", "polish", "summary"],
  },
  {
    id: "visualization",
    label: "数据可视化",
    task: /(?:可视化|图表|仪表盘|看板|趋势图|visualization|chart|graph|dashboard|plot)/i,
    skill: /(?:visualization|chart|graph|dashboard|plot|可视化|图表|看板)/i,
    reason: "负责生成图表或交互可视化",
    hints: ["visualize", "chart"],
  },
  {
    id: "collaboration",
    label: "协作消息",
    task: /(?:\bslack\b|teams|频道消息|工作区消息|发消息|消息摘要|回复草稿)/i,
    skill: /(?:\bslack\b|\bteams\b|channel summary|outbound.*message|reply draft|daily digest)/i,
    reason: "负责读取、整理或发送协作消息",
    hints: ["slack", "teams"],
  },
  {
    id: "ticket",
    label: "工单处理",
    task: /(?:工单|tt\.sankuai\.com|催办|转单|服务目录|ticket)/i,
    skill: /(?:工单|tt\.sankuai\.com|ticket|服务目录|转单)/i,
    reason: "负责查询、创建或流转工单",
    hints: ["ticket", "tt"],
  },
];

const INFRASTRUCTURE = /(?:control-in-app-browser|control-chrome|excel-live-control|figma-use(?:$|:|-))/i;

function displayPath(value) {
  const home = os.homedir();
  return value.startsWith(`${home}${path.sep}`) ? `~${value.slice(home.length)}` : value;
}

function cleanScalar(value) {
  const text = value.trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    return text.slice(1, -1);
  }
  return text;
}

export function parseSkillDocument(content) {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const frontmatter = match?.[1] || "";
  const readValue = (key) => {
    const lines = frontmatter.split(/\r?\n/);
    const pattern = new RegExp(`^${key}:\\s*(.*)$`, "i");
    for (let index = 0; index < lines.length; index += 1) {
      const found = lines[index].match(pattern);
      if (!found) continue;
      if (!["|", ">"].includes(found[1].trim())) return cleanScalar(found[1]);
      const block = [];
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        if (!/^\s+/.test(lines[cursor])) break;
        block.push(lines[cursor].trim());
      }
      return block.join(found[1].trim() === ">" ? " " : "\n");
    }
    return "";
  };
  return {
    name: readValue("name"),
    description: readValue("description"),
    body: match ? content.slice(match[0].length) : content,
    frontmatter,
  };
}

async function readConfig() {
  try {
    const value = JSON.parse(await readFile(CONFIG_FILE, "utf8"));
    return {
      customRoots: Array.isArray(value.customRoots)
        ? value.customRoots.filter((item) => typeof item === "string")
        : [],
    };
  } catch {
    return { customRoots: [] };
  }
}

async function writeConfig(config) {
  await mkdir(CONFIG_DIR, { recursive: true });
  const temporary = `${CONFIG_FILE}.tmp`;
  await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  await rename(temporary, CONFIG_FILE);
}

function automaticRoots() {
  const home = os.homedir();
  const codex = process.env.CODEX_HOME || path.join(home, ".codex");
  const extra = String(process.env.SKILL_FOR_SKILLS_PATHS || "")
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
  return [
    ["codex", "Codex Skills", path.join(codex, "skills")],
    ["plugin", "Codex Plugins", path.join(codex, "plugins", "cache")],
    ["claude", "Claude Skills", path.join(home, ".claude", "skills")],
    ["agents", "Agent Skills", path.join(home, ".agents", "skills")],
    ["cursor", "Cursor Skills", path.join(home, ".cursor", "skills")],
    ["opencode", "OpenCode Skills", path.join(home, ".opencode", "skills")],
    ["opencode", "OpenCode Config Skills", path.join(home, ".config", "opencode", "skills")],
    ...extra.map((value) => ["environment", "Environment Skill Path", value]),
  ].map(([kind, label, value]) => ({
    kind,
    label,
    path: path.resolve(value),
    automatic: true,
  }));
}

export async function getSkillRoots() {
  const config = await readConfig();
  const roots = [
    ...automaticRoots(),
    ...config.customRoots.map((value) => ({
      kind: "custom",
      label: "Custom Skills",
      path: path.resolve(value),
      automatic: false,
    })),
  ];
  const unique = new Map();
  for (const root of roots) {
    let resolved = root.path;
    try {
      resolved = await realpath(root.path);
    } catch {
      // Preserve unavailable roots so clients can explain their status.
    }
    if (!unique.has(resolved)) unique.set(resolved, { ...root, path: resolved });
  }
  const output = [];
  for (const root of unique.values()) {
    let available = false;
    try {
      available = (await stat(root.path)).isDirectory();
    } catch {
      available = false;
    }
    output.push({ ...root, available, displayPath: displayPath(root.path) });
  }
  return output;
}

function normalizeCustomRoot(input) {
  if (typeof input !== "string" || !input.trim()) {
    throw new Error("请输入具体的 Skill 文件夹路径");
  }
  const trimmed = input.trim();
  const expanded =
    trimmed === "~"
      ? os.homedir()
      : trimmed.startsWith(`~${path.sep}`)
        ? path.join(os.homedir(), trimmed.slice(2))
        : trimmed;
  const normalized = path.resolve(expanded);
  if (
    normalized === path.parse(normalized).root ||
    normalized === os.homedir()
  ) {
    throw new Error("为保护隐私，不能扫描整块磁盘或整个用户目录");
  }
  return normalized;
}

export async function addCustomRoot(input) {
  const normalized = normalizeCustomRoot(input);
  let resolved;
  try {
    resolved = await realpath(normalized);
  } catch {
    throw new Error("找不到这个文件夹");
  }
  if (!(await stat(resolved)).isDirectory()) throw new Error("所选路径不是文件夹");
  const config = await readConfig();
  if (!config.customRoots.includes(resolved)) {
    config.customRoots.push(resolved);
    await writeConfig(config);
  }
  return getSkillRoots();
}

export async function removeCustomRoot(input) {
  const normalized = normalizeCustomRoot(input);
  let resolved = normalized;
  try {
    resolved = await realpath(normalized);
  } catch {
    // Missing directories can still be removed from configuration.
  }
  const config = await readConfig();
  config.customRoots = config.customRoots.filter(
    (item) => item !== resolved && item !== normalized,
  );
  await writeConfig(config);
  return getSkillRoots();
}

async function findSkillFiles(root) {
  const files = [];
  const pending = [root];
  while (pending.length && files.length < MAX_FILES) {
    const current = pending.pop();
    let entries = [];
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (
        entry.isDirectory() &&
        [".git", "node_modules", "dist", "generated_images"].includes(entry.name)
      ) {
        continue;
      }
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      if (entry.isFile() && entry.name === "SKILL.md") files.push(target);
      if (files.length >= MAX_FILES) break;
    }
  }
  return files;
}

async function nearestPlugin(filePath, rootPath) {
  let cursor = path.dirname(filePath);
  const boundary = path.dirname(rootPath);
  while (cursor.startsWith(boundary)) {
    try {
      const manifest = JSON.parse(
        await readFile(path.join(cursor, ".codex-plugin", "plugin.json"), "utf8"),
      );
      return {
        name: manifest.name || path.basename(cursor),
        version: manifest.version || null,
      };
    } catch {
      // Keep walking toward the root.
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return null;
}

function detectCapabilities(skill) {
  const searchable = `${skill.qualifiedName}\n${skill.description}`;
  return CAPABILITIES.filter((item) => item.skill.test(searchable)).map(
    (item) => item.id,
  );
}

async function loadSkill(filePath, root) {
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat || fileStat.size > MAX_BYTES) return null;
  const content = await readFile(filePath, "utf8").catch(() => "");
  if (!content) return null;
  const parsed = parseSkillDocument(content);
  const name = parsed.name || path.basename(path.dirname(filePath));
  const plugin = await nearestPlugin(filePath, root.path);
  const qualifiedName =
    plugin?.name && !name.includes(":") ? `${plugin.name}:${name}` : name;
  if (SELF_NAMES.has(name) || SELF_NAMES.has(qualifiedName)) return null;
  const excerpt = parsed.body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_[\]`]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 2_000);
  const skill = {
    id: qualifiedName,
    name,
    qualifiedName,
    description: parsed.description || excerpt.slice(0, 240),
    excerpt,
    filePath,
    source: plugin ? "plugin" : root.kind,
    version: plugin?.version || null,
    requiresSetup: /(?:api[_ -]?key|需要登录|requires? (?:an? )?(?:api key|login))/i.test(
      `${parsed.frontmatter}\n${excerpt}`,
    ),
    explicitSelectionOnly:
      /(?:use|trigger)(?: this skill)? only when the user (?:selects|names|explicitly|asks)|use when the user (?:selects|names)|仅当用户(?:选择|点名|明确)/i.test(
        parsed.description,
      ),
    modifiedAt: fileStat.mtimeMs,
  };
  skill.capabilities = detectCapabilities(skill);
  return skill;
}

export async function scanSkillInventory() {
  const roots = await getSkillRoots();
  const groups = await Promise.all(
    roots
      .filter((root) => root.available)
      .map(async (root) =>
        (await findSkillFiles(root.path)).map((filePath) => ({ filePath, root })),
      ),
  );
  const loaded = await Promise.all(
    groups.flat().map(({ filePath, root }) => loadSkill(filePath, root)),
  );
  const unique = new Map();
  for (const skill of loaded.filter(Boolean)) {
    const current = unique.get(skill.qualifiedName);
    if (!current || skill.modifiedAt > current.modifiedAt) {
      unique.set(skill.qualifiedName, skill);
    }
  }
  const skills = [...unique.values()].sort((left, right) =>
    left.qualifiedName.localeCompare(right.qualifiedName, "zh-CN"),
  );
  const counts = {};
  for (const skill of skills) counts[skill.source] = (counts[skill.source] || 0) + 1;
  return { skills, total: skills.length, counts, roots, scannedAt: new Date().toISOString() };
}

function taskTokens(task) {
  const normalized = task.toLowerCase();
  const tokens = new Set(normalized.match(/[a-z0-9][a-z0-9+#._-]{1,}/g) || []);
  for (const token of [...tokens]) {
    for (const part of token.split(/[-_.]/)) if (part.length >= 2) tokens.add(part);
  }
  for (const run of normalized.match(/[\u3400-\u9fff]{2,}/g) || []) {
    const value = run.slice(0, 40);
    for (let size = 2; size <= Math.min(4, value.length); size += 1) {
      for (let index = 0; index <= value.length - size; index += 1) {
        tokens.add(value.slice(index, index + size));
        if (tokens.size >= 160) return [...tokens];
      }
    }
  }
  return [...tokens];
}

function scoreSkill(skill, task, detected, tokens) {
  const matched = detected.filter((item) => skill.capabilities.includes(item.id));
  const name = skill.qualifiedName.toLowerCase();
  const description = `${skill.description}\n${skill.excerpt}`.toLowerCase();
  const normalizedTask = task.toLowerCase();
  let score = matched.length * 14;
  for (const token of tokens.slice(0, 80)) {
    if (name.includes(token)) score += 4;
    else if (description.includes(token)) score += 1.2;
  }
  for (const item of matched) {
    if (item.hints.some((hint) => name.includes(hint))) score += 5;
  }
  if (normalizedTask.includes(name) || normalizedTask.includes(skill.name.toLowerCase())) {
    score += 16;
  }
  if (
    skill.explicitSelectionOnly &&
    !normalizedTask.includes(name) &&
    !normalizedTask.includes(skill.name.toLowerCase())
  ) {
    score -= 18;
  }
  if (skill.requiresSetup) score -= 1.5;
  return {
    ...skill,
    score: Math.max(0, Number(score.toFixed(2))),
    matchedCapabilities: matched.map((item) => item.id),
    infrastructure: INFRASTRUCTURE.test(skill.qualifiedName),
  };
}

export function routeTask(task, skills) {
  const cleanTask = String(task || "").trim();
  if (!cleanTask) throw new Error("任务内容不能为空");
  if (cleanTask.length > 4_000) throw new Error("任务内容不能超过 4000 个字符");
  const detected = CAPABILITIES.filter((item) => item.task.test(cleanTask));
  const ranked = skills
    .map((skill) => scoreSkill(skill, cleanTask, detected, taskTokens(cleanTask)))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.qualifiedName.localeCompare(right.qualifiedName),
    );
  const meaningful = ranked.filter((skill) => skill.score >= 4);
  const nonInfrastructure = meaningful.filter((skill) => !skill.infrastructure);
  const browserOnly = detected.length === 1 && detected[0]?.id === "browser";
  const primary =
    (browserOnly ? meaningful[0] : nonInfrastructure[0]) ||
    meaningful[0] ||
    ranked[0];
  const selected = primary ? [primary] : [];
  const covered = new Set(primary?.matchedCapabilities || []);
  for (const capability of detected) {
    if (selected.length >= 3 || covered.has(capability.id)) continue;
    const helper = meaningful.find(
      (skill) =>
        !selected.some((item) => item.id === skill.id) &&
        skill.matchedCapabilities.includes(capability.id),
    );
    if (helper) {
      selected.push(helper);
      helper.matchedCapabilities.forEach((item) => covered.add(item));
    }
  }
  const format = (skill, index) => ({
    id: skill.id,
    name: skill.qualifiedName,
    role: index === 0 ? "主 Skill" : "辅助 Skill",
    reason:
      CAPABILITIES.find((item) =>
        skill.matchedCapabilities.includes(item.id),
      )?.reason || skill.description,
    filePath: skill.filePath,
    source: skill.source,
    version: skill.version,
    score: skill.score,
    matchedCapabilities: skill.matchedCapabilities,
  });
  const selectedIds = new Set(selected.map((skill) => skill.id));
  const selectedOutput = selected.map(format);
  const alternatives = meaningful
    .filter((skill) => !selectedIds.has(skill.id))
    .slice(0, 5)
    .map((skill, index) => format(skill, index + 1));
  const coverage = detected.length ? covered.size / detected.length : primary?.score >= 4 ? 0.55 : 0.2;
  return {
    task: cleanTask,
    detectedCapabilities: detected.map(({ id, label }) => ({ id, label })),
    selected: selectedOutput,
    alternatives,
    confidence:
      primary?.score >= 18 && coverage >= 0.7
        ? "high"
        : primary?.score >= 8
          ? "medium"
          : "low",
    coverage: Number(coverage.toFixed(2)),
    routeSummary: selectedOutput.map((skill) => skill.name).join(" → "),
  };
}

export async function routeWithInventory(task) {
  const inventory = await scanSkillInventory();
  return {
    ...routeTask(task, inventory.skills),
    inventory: {
      total: inventory.total,
      counts: inventory.counts,
      scannedAt: inventory.scannedAt,
      roots: inventory.roots.map(({ kind, label, displayPath: rootPath, automatic, available }) => ({
        kind,
        label,
        path: rootPath,
        automatic,
        available,
      })),
    },
  };
}

function publicInventory(inventory) {
  return {
    total: inventory.total,
    counts: inventory.counts,
    scannedAt: inventory.scannedAt,
    roots: inventory.roots.map(({ kind, label, displayPath: rootPath, automatic, available }) => ({
      kind,
      label,
      path: rootPath,
      automatic,
      available,
    })),
    skills: inventory.skills.map((skill) => ({
      name: skill.qualifiedName,
      description: skill.description,
      filePath: skill.filePath,
      source: skill.source,
      version: skill.version,
      capabilities: skill.capabilities,
    })),
  };
}

async function readBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 16 * 1024) throw new Error("请求内容过大");
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

export function startServer(port = 4319) {
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/health") {
        return sendJson(response, 200, { ok: true, name: "skill-for-skills" });
      }
      if (request.method === "GET" && url.pathname === "/skills") {
        return sendJson(response, 200, publicInventory(await scanSkillInventory()));
      }
      if (request.method === "GET" && url.pathname === "/roots") {
        return sendJson(response, 200, await getSkillRoots());
      }
      if (request.method === "POST" && url.pathname === "/route") {
        const body = await readBody(request);
        return sendJson(response, 200, await routeWithInventory(body.task));
      }
      if (request.method === "POST" && url.pathname === "/roots") {
        const body = await readBody(request);
        return sendJson(response, 201, await addCustomRoot(body.path));
      }
      if (request.method === "DELETE" && url.pathname === "/roots") {
        const body = await readBody(request);
        return sendJson(response, 200, await removeCustomRoot(body.path));
      }
      return sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      return sendJson(response, 400, {
        error: error instanceof Error ? error.message : "Router failed",
      });
    }
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Skill for Skills listening on http://127.0.0.1:${port}`);
  });
  return server;
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(args = process.argv.slice(2)) {
  const [command] = args;
  let output;
  if (command === "route") {
    const task = optionValue(args, "--task") || args.slice(1).join(" ");
    output = await routeWithInventory(task);
  } else if (command === "scan") {
    output = publicInventory(await scanSkillInventory());
  } else if (command === "roots") {
    output = await getSkillRoots();
  } else if (command === "add-root") {
    output = await addCustomRoot(args.slice(1).join(" "));
  } else if (command === "remove-root") {
    output = await removeCustomRoot(args.slice(1).join(" "));
  } else if (command === "serve") {
    const port = Number(optionValue(args, "--port") || 4319);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("端口必须是 1 到 65535 之间的整数");
    }
    startServer(port);
    return;
  } else {
    throw new Error(
      "用法：skill-router.mjs <route|scan|roots|add-root|remove-root|serve>",
    );
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
