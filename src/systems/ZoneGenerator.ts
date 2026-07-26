/**
 * Point d'entrée unique pour obtenir un ZoneMap "prêt à jouer" — que ce soit via l'IA (si
 * `VITE_ZONE_AI_ENDPOINT` est configuré) ou le générateur procédural de secours. L'appelant
 * (cf. GameScene.loadZone) n'a jamais besoin de savoir laquelle des deux voies a produit le
 * résultat : les deux renvoient un ZoneMap valide, dans la même forme.
 *
 * Le roster d'entités (identité narrative : dialogTree, bossId, puzzleId, tier...) vient
 * toujours de la carte statique existante (cf. LevelLoader.getZoneMap) — "les chapitres
 * restent tels qu'ils sont" ; seuls `tiles`/`cols`/`rows` et les `x`/`y` de chaque entité sont
 * régénérés à chaque nouvelle partie.
 */
import type { ZoneEntity, ZoneMap } from '@/utils/Types';
import { getZoneMap } from './LevelLoader';
import { generateZoneMap } from './ProceduralZoneGenerator';
import { validateZoneMap } from './ZoneValidator';
import { ZONE_PROFILES, MAX_JUMP_TILES, TILE_LEGEND } from './zoneProfiles';
import type { ZoneProfile } from './zoneProfiles';

const AI_ENDPOINT = import.meta.env.VITE_ZONE_AI_ENDPOINT;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_JUMP_RISE_TILES = 5;

interface AiResponse {
  tiles?: string[];
  placements?: { index: number; x: number; y: number }[];
  error?: string;
}

async function fetchAiZoneMap(zoneId: string, meta: ZoneMap, profile: ZoneProfile): Promise<ZoneMap | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const entityRoster = meta.entities.map((e, index) => ({
      index,
      type: e.type,
      optional: e.type === 'npc' ? e.optional : undefined,
    }));

    const res = await fetch(AI_ENDPOINT as string, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        zoneId,
        cols: profile.cols,
        rows: profile.rows,
        tileLegend: TILE_LEGEND,
        jumpConstraints: { maxJumpTiles: MAX_JUMP_TILES, maxJumpRiseTiles: MAX_JUMP_RISE_TILES },
        theme: { ambiance: meta.ambiance, act: meta.act },
        entityRoster,
      }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as AiResponse;
    if (data.error || !data.tiles || !data.placements) return null;

    const placementByIndex = new Map(data.placements.map((p) => [p.index, p]));
    const entities: ZoneEntity[] = meta.entities.map((entity, i) => {
      const placement = placementByIndex.get(i);
      return placement ? { ...entity, x: placement.x, y: placement.y } : entity;
    });

    return { ...meta, cols: profile.cols, rows: profile.rows, tiles: data.tiles, entities };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Génère (ou récupère via l'IA) la disposition d'une zone. N'implémente PAS le cache par
 * partie — cf. GameState.generatedZones/SaveData.generatedZones, qui décident quand rappeler
 * ceci plutôt que de réutiliser un layout déjà généré cette partie.
 */
export async function generateZoneLive(zoneId: string): Promise<ZoneMap> {
  const meta = getZoneMap(zoneId);
  const profile = ZONE_PROFILES[zoneId];

  if (AI_ENDPOINT && profile) {
    const aiMap = await fetchAiZoneMap(zoneId, meta, profile);
    if (aiMap) {
      const result = validateZoneMap(aiMap);
      if (result.valid) return aiMap;
      // eslint-disable-next-line no-console
      console.warn(`[ZoneGenerator] AI layout for "${zoneId}" rejected (${result.reason}) — falling back.`);
    } else {
      // eslint-disable-next-line no-console
      console.warn(`[ZoneGenerator] AI generation unavailable for "${zoneId}" — falling back.`);
    }
  }

  if (!profile) return meta; // pas de profil connu (ne devrait pas arriver) : renvoie la carte statique telle quelle
  return generateZoneMap(zoneId, meta, meta.entities);
}
