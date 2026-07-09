/**
 * Curated public personal facts for DM.
 *
 * This module is the complete allowlist for personal, hobby, interest, and
 * easter-egg answers. Keep entries non-sensitive and owner-reviewed. DM must
 * decline personal topics that are not represented here.
 */

export type PersonalFactCategory = 'outside-work' | 'interest' | 'easter-egg';

export interface PersonalFact {
  id: string;
  category: PersonalFactCategory;
  title: string;
  summary: string;
  tags: string[];
  href?: string;
}

/**
 * These entries restate facts already present in Dylan's public, owner-authored
 * résumé and project catalog. They intentionally avoid family, relationships,
 * health, beliefs, precise location, and other sensitive personal details.
 */
export const PERSONAL_FACTS: PersonalFact[] = [
  {
    id: 'practical-side-projects',
    category: 'outside-work',
    title: 'Practical side projects',
    summary:
      'Outside paid work, Dylan builds practical side projects around assistant evaluation, local finance automation, infrastructure scheduling, and small consumer apps.',
    tags: ['outside work', 'side projects', 'building', 'apps', 'automation'],
    href: '/library',
  },
  {
    id: 'markets-and-trading',
    category: 'interest',
    title: 'Markets and trading systems',
    summary:
      'Markets are a recurring side-project theme, including trading automation, options-exit tooling, local portfolio tracking, and repeatable chart review.',
    tags: ['markets', 'trading', 'finance', 'options', 'charts', 'chart review'],
    href: '/library/trading-systems',
  },
  {
    id: 'homelab',
    category: 'interest',
    title: 'Home infrastructure',
    summary:
      'Dylan runs a three-node home lab and uses it to practice reproducible, self-hosted infrastructure and reliability.',
    tags: ['homelab', 'home lab', 'self-hosting', 'infrastructure', 'nixos', 'reliability'],
    href: '/projects/homeserver',
  },
  {
    id: 'games-as-test-beds',
    category: 'easter-egg',
    title: 'Games as test beds',
    summary:
      'One shelved experiment used browser games as repeatable test beds for comparing assistant behavior instead of judging changes by feel.',
    tags: ['games', 'browser games', 'experiments', 'assistant evaluation', 'easter egg'],
    href: '/projects/harness-arena',
  },
];

const BROAD_PERSONAL_QUERY_PATTERNS = [
  /\boutside (?:of )?work\b/,
  /\bfree time\b/,
  /\bspare time\b/,
  /\boff hours?\b/,
  /\bhobb(?:y|ies)\b/,
  /\binterests?\b/,
  /\bfun facts?\b/,
  /\beaster eggs?\b/,
];

const PERSONAL_SEARCH_STOP_WORDS = new Set([
  'about',
  'and',
  'does',
  'dylan',
  'favorite',
  'favourite',
  'has',
  'his',
  'like',
  'personal',
  'tell',
  'the',
  'what',
]);

export function findPersonalFacts(query = ''): PersonalFact[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized || BROAD_PERSONAL_QUERY_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return [...PERSONAL_FACTS];
  }

  const tokens = normalized
    .replace(/[^a-z0-9-]+/g, ' ')
    .split(' ')
    .filter((token) => token.length > 2 && !PERSONAL_SEARCH_STOP_WORDS.has(token));

  if (tokens.length === 0) return [];

  return PERSONAL_FACTS.filter((fact) => {
    const haystack = [fact.id, fact.category, fact.title, fact.summary, ...fact.tags].join(' ').toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  });
}
