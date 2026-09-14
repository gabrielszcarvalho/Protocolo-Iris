import { capitulo1 } from './cap01';
import { capitulo2 } from './cap02';
import { capitulo3 } from './cap03';
import { capitulo4 } from './cap04';
import { capitulo5 } from './cap05';
import { capitulo6 } from './cap06';
import { capitulo7 } from './cap07';
import { capitulo8 } from './cap08';
import { capitulo9 } from './cap09';
import { capitulo10 } from './cap10';
import type { Capitulo, Missao } from './tipos';

export type { Capitulo, Missao } from './tipos';

export const CAPITULOS: Capitulo[] = [capitulo1, capitulo2, capitulo3, capitulo4, capitulo5, capitulo6, capitulo7, capitulo8, capitulo9, capitulo10];

export const TODAS_AS_MISSOES: Missao[] = CAPITULOS.flatMap((c) => c.missoes);

export const MISSAO_POR_ID = new Map(TODAS_AS_MISSOES.map((m) => [m.id, m]));

export const CAPITULO_DA_MISSAO = new Map(CAPITULOS.flatMap((c) => c.missoes.map((m) => [m.id, c] as const)));
