import {
  SiPython, SiJavascript, SiTypescript, SiReact, SiHtml5, SiCss3, SiSass,
  SiJson, SiMarkdown, SiYaml, SiGnubash, SiRust, SiGo, SiPhp, SiRuby,
  SiSwift, SiKotlin, SiCplusplus, SiC, SiDocker, SiGit, SiVuedotjs,
  SiSvelte, SiGraphql, SiToml, SiPrisma, SiTailwindcss, SiVite, SiNpm,
  SiEslint, SiPrettier,
} from "react-icons/si";
import { FaJava, FaDatabase, FaFileCode, FaImage, FaFont, FaLock } from "react-icons/fa";
import { File as FileIcon, FileText, Folder, FolderOpen } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type IconCmp = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

const BY_EXT: Record<string, { Icon: IconCmp; color: string }> = {
  py: { Icon: SiPython, color: "text-yellow-400" },
  js: { Icon: SiJavascript, color: "text-yellow-300" },
  mjs: { Icon: SiJavascript, color: "text-yellow-300" },
  cjs: { Icon: SiJavascript, color: "text-yellow-300" },
  jsx: { Icon: SiReact, color: "text-sky-400" },
  ts: { Icon: SiTypescript, color: "text-sky-500" },
  tsx: { Icon: SiReact, color: "text-sky-400" },
  vue: { Icon: SiVuedotjs, color: "text-emerald-400" },
  svelte: { Icon: SiSvelte, color: "text-orange-500" },
  html: { Icon: SiHtml5, color: "text-orange-400" },
  htm: { Icon: SiHtml5, color: "text-orange-400" },
  css: { Icon: SiCss3, color: "text-blue-400" },
  scss: { Icon: SiSass, color: "text-pink-400" },
  sass: { Icon: SiSass, color: "text-pink-400" },
  json: { Icon: SiJson, color: "text-amber-300" },
  md: { Icon: SiMarkdown, color: "text-zinc-300" },
  mdx: { Icon: SiMarkdown, color: "text-zinc-300" },
  yml: { Icon: SiYaml, color: "text-purple-300" },
  yaml: { Icon: SiYaml, color: "text-purple-300" },
  toml: { Icon: SiToml, color: "text-orange-300" },
  sh: { Icon: SiGnubash, color: "text-emerald-400" },
  bash: { Icon: SiGnubash, color: "text-emerald-400" },
  zsh: { Icon: SiGnubash, color: "text-emerald-400" },
  rs: { Icon: SiRust, color: "text-orange-500" },
  go: { Icon: SiGo, color: "text-sky-400" },
  php: { Icon: SiPhp, color: "text-indigo-400" },
  rb: { Icon: SiRuby, color: "text-red-500" },
  swift: { Icon: SiSwift, color: "text-orange-500" },
  kt: { Icon: SiKotlin, color: "text-purple-400" },
  java: { Icon: FaJava, color: "text-red-400" },
  cpp: { Icon: SiCplusplus, color: "text-blue-500" },
  cc: { Icon: SiCplusplus, color: "text-blue-500" },
  cxx: { Icon: SiCplusplus, color: "text-blue-500" },
  hpp: { Icon: SiCplusplus, color: "text-blue-500" },
  c: { Icon: SiC, color: "text-blue-400" },
  h: { Icon: SiC, color: "text-blue-400" },
  graphql: { Icon: SiGraphql, color: "text-pink-500" },
  gql: { Icon: SiGraphql, color: "text-pink-500" },
  prisma: { Icon: SiPrisma, color: "text-emerald-400" },
  sql: { Icon: FaDatabase, color: "text-amber-400" },
  db: { Icon: FaDatabase, color: "text-amber-400" },
  env: { Icon: FaLock, color: "text-amber-500" },
  lock: { Icon: FaLock, color: "text-zinc-400" },
  png: { Icon: FaImage, color: "text-pink-400" },
  jpg: { Icon: FaImage, color: "text-pink-400" },
  jpeg: { Icon: FaImage, color: "text-pink-400" },
  gif: { Icon: FaImage, color: "text-pink-400" },
  svg: { Icon: FaImage, color: "text-orange-300" },
  webp: { Icon: FaImage, color: "text-pink-400" },
  ico: { Icon: FaImage, color: "text-amber-300" },
  ttf: { Icon: FaFont, color: "text-zinc-300" },
  otf: { Icon: FaFont, color: "text-zinc-300" },
  woff: { Icon: FaFont, color: "text-zinc-300" },
  woff2: { Icon: FaFont, color: "text-zinc-300" },
  txt: { Icon: FileText, color: "text-zinc-300" },
};

const BY_NAME: Record<string, { Icon: IconCmp; color: string }> = {
  "dockerfile": { Icon: SiDocker, color: "text-sky-400" },
  ".gitignore": { Icon: SiGit, color: "text-orange-400" },
  ".gitattributes": { Icon: SiGit, color: "text-orange-400" },
  "package.json": { Icon: SiNpm, color: "text-red-400" },
  "bun.lock": { Icon: FaLock, color: "text-pink-300" },
  "bun.lockb": { Icon: FaLock, color: "text-pink-300" },
  "package-lock.json": { Icon: FaLock, color: "text-red-300" },
  "yarn.lock": { Icon: FaLock, color: "text-blue-300" },
  "pnpm-lock.yaml": { Icon: FaLock, color: "text-amber-300" },
  ".eslintrc": { Icon: SiEslint, color: "text-indigo-400" },
  ".prettierrc": { Icon: SiPrettier, color: "text-pink-300" },
  "tailwind.config.js": { Icon: SiTailwindcss, color: "text-sky-400" },
  "tailwind.config.ts": { Icon: SiTailwindcss, color: "text-sky-400" },
  "vite.config.ts": { Icon: SiVite, color: "text-purple-400" },
  "vite.config.js": { Icon: SiVite, color: "text-purple-400" },
};

export function getFileIcon(name: string) {
  const lower = name.toLowerCase();
  const byName = BY_NAME[lower];
  if (byName) return byName;
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  return BY_EXT[ext] ?? { Icon: FaFileCode as IconCmp, color: "text-muted-foreground" };
}

export function FileNodeIcon({ name, className = "h-3.5 w-3.5" }: { name: string; className?: string }) {
  const { Icon, color } = getFileIcon(name);
  return <Icon className={`${className} ${color} flex-shrink-0`} />;
}

export function FolderNodeIcon({ open, className = "h-3.5 w-3.5" }: { open?: boolean; className?: string }) {
  const Icon = open ? FolderOpen : Folder;
  return <Icon className={`${className} text-sky-400 flex-shrink-0`} />;
}

export { FileIcon };
