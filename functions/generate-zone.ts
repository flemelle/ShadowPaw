/**
 * Cloudflare Pages Function — POST /generate-zone
 *
 * Proxy serveur pour la génération IA de la disposition interne d'une zone : reçoit les
 * contraintes structurelles + le roster d'entités FIXE de la zone (cf. src/systems/
 * zoneProfiles.ts / ZoneGenerator.ts côté client), demande à Claude une grille de tuiles +
 * un placement par entité, et renvoie ça en JSON. La clé API ne vit QUE côté serveur (secret
 * Cloudflare `ANTHROPIC_API_KEY`, jamais dans le bundle client ni dans ce fichier).
 *
 * Déploiement (cf. README pour le détail) :
 *   wrangler login
 *   wrangler pages secret put ANTHROPIC_API_KEY   (dans le projet Pages)
 *   wrangler pages deploy
 */

interface Env {
  ANTHROPIC_API_KEY: string;
}

interface GenerateZoneRequest {
  zoneId: string;
  cols: number;
  rows: number;
  tileLegend: Record<string, string>;
  jumpConstraints: {
    maxJumpTiles: number;
    maxJumpRiseTiles: number;
  };
  /** Juste assez pour situer le ton de la zone dans le prompt — pas les paramètres internes
   * du générateur procédural (pitChance, etc.), qui ne veulent rien dire pour un LLM. */
  theme: { ambiance: string; act: 1 | 2 };
  /** Roster figé (identité narrative déjà fixée côté client) — seul l'index sert de référence
   * pour le placement retourné, aucun champ d'identité n'est renvoyé par le modèle. */
  entityRoster: { index: number; type: string; optional?: boolean }[];
}

// Modèle Anthropic à utiliser — À VÉRIFIER/METTRE À JOUR au moment du déploiement : la liste
// des modèles disponibles évolue, cf. https://docs.anthropic.com/en/docs/about-claude/models
const ANTHROPIC_MODEL = 'claude-sonnet-4-5-20250929';
const ANTHROPIC_TIMEOUT_MS = 15_000;

function buildPrompt(req: GenerateZoneRequest): string {
  const legend = Object.entries(req.tileLegend)
    .map(([ch, desc]) => `  "${ch}" = ${desc}`)
    .join('\n');
  const entities = req.entityRoster
    .map((e) => `  ${e.index}: ${e.type}${e.optional ? ' (optionnel)' : ''}`)
    .join('\n');

  return `Tu génères la disposition d'un niveau de plateforme 2D (metroidvania dark fantasy).

Grille : ${req.cols} colonnes x ${req.rows} rangées. Légende des caractères :
${legend}

Contraintes physiques de saut (à respecter STRICTEMENT pour que le niveau soit franchissable) :
- Portée horizontale maximale d'un saut : ${req.jumpConstraints.maxJumpTiles.toFixed(1)} tuiles.
- Montée maximale franchissable en un saut : ${req.jumpConstraints.maxJumpRiseTiles} tuiles.
- Toute fosse (colonnes sans aucune tuile solide) plus large que la portée de saut est une
  mort certaine — n'en crée jamais.

Ambiance : ${req.theme.ambiance} (Acte ${req.theme.act}).

Entités à placer (rôle fixé, seule leur position doit être décidée) :
${entities}

Règles de placement :
- Chaque entité doit être posée SUR une tuile solide ('#'), à la position juste au-dessus
  (case vide '.' avec une tuile solide directement en dessous).
- Toutes les entités (sauf marquées "optionnel") doivent être atteignables à pied ou au saut
  depuis l'entité "spawn", en respectant les contraintes de saut ci-dessus.
- La zone doit avoir un sol globalement traversable de gauche à droite, avec quelques
  variations (fosses franchissables, plateformes) plutôt qu'un couloir plat sans relief.
- "zone_exit"/"ending_trigger" doit être proche de la fin (grande colonne), "spawn" proche
  du début (petite colonne). "boss_arena" doit être juste avant la sortie, sur une grande
  plaine plate sans plateforme flottante ni fosse sur au moins 28 colonnes de large.

Réponds UNIQUEMENT avec un objet JSON, sans texte autour, de cette forme exacte :
{"tiles": ["...", "..."], "placements": [{"index": 0, "x": 3, "y": 10}, ...]}
"tiles" doit avoir exactement ${req.rows} chaînes de longueur exactement ${req.cols}, avec
uniquement les caractères de la légende. "x"/"y" sont des indices de colonne/rangée (entiers).`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Le modèle a peut-être entouré la réponse de ```json ... ``` malgré la consigne.
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON object found in model response');
    return JSON.parse(match[0]);
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body: GenerateZoneRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON body' }), { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPrompt(body) }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return new Response(JSON.stringify({ error: `Anthropic API error: ${errText}` }), { status: 502 });
    }

    const data = (await anthropicRes.json()) as { content: { type: string; text?: string }[] };
    const textBlock = data.content.find((b) => b.type === 'text');
    if (!textBlock?.text) {
      return new Response(JSON.stringify({ error: 'no text content in Anthropic response' }), { status: 502 });
    }

    const parsed = extractJson(textBlock.text);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 504 });
  } finally {
    clearTimeout(timeout);
  }
};
