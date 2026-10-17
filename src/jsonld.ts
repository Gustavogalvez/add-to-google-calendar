export type JsonLdNode = Record<string, unknown>;

const NESTED_KEYS = ["@graph", "itemListElement", "item", "mainEntity", "subEvent", "events"] as const;
const MAX_RAW_LENGTH = 262_144;

function isNode(value: unknown): value is JsonLdNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractJsonLd(root: ParentNode): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  for (const script of root.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')) {
    const raw = script.textContent?.trim();
    if (!raw || raw.length > MAX_RAW_LENGTH) continue;
    try {
      walk(JSON.parse(raw) as unknown, nodes);
    } catch {
      continue;
    }
  }
  return nodes;
}

function walk(value: unknown, out: JsonLdNode[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) walk(entry, out);
    return;
  }
  if (!isNode(value)) return;
  out.push(value);
  for (const key of NESTED_KEYS) {
    if (Object.hasOwn(value, key)) walk(value[key], out);
  }
}

export function isEventNode(node: JsonLdNode): boolean {
  const raw = node["@type"];
  const types = Array.isArray(raw) ? raw : [raw];
  return types.some((type) => typeof type === "string" && /(?:^|[/#])[A-Za-z]*Event$/.test(type));
}
