import { capitulo1 } from './cap01';
import { capitulo2 } from './cap02';
import { capitulo3 } from './cap03';
import type { Capitulo, Missao } from './tipos';

export type { Capitulo, Missao } from './tipos';

export const CAPITULOS: Capitulo[] = [capitulo1, capitulo2, capitulo3];

export const TODAS_AS_MISSOES: Missao[] = CAPITULOS.flatMap((c) => c.missoes);

export const MISSAO_POR_ID = new Map(TODAS_AS_MISSOES.map((m) => [m.id, m]));

export const CAPITULO_DA_MISSAO = new Map(CAPITULOS.flatMap((c) => c.missoes.map((m) => [m.id, c] as const)));
