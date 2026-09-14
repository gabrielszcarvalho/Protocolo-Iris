import { ARVORE, NO_POR_ID, NO_POR_CHAVE, RAIZ, criarVerificador, situacaoDoNo } from '../../src/game/arvore';
import { TODAS_AS_MISSOES } from '../../src/game/missoes';
import { CredencialError } from '../../src/engine/errors';

describe('Árvore de Credenciamento', () => {
  it('ids únicos e requisitos existentes', () => {
    expect(new Set(ARVORE.map((n) => n.id)).size).toBe(ARVORE.length);
    for (const no of ARVORE) for (const r of no.requer) expect(NO_POR_ID.has(r), `${no.id} requer ${r}`).toBe(true);
  });

  it('cada chave pertence a um único nó', () => {
    const chaves = ARVORE.flatMap((n) => n.libera.map((l) => l.chave));
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it('toda credencial exigida por missão existe e está disponível', () => {
    for (const m of TODAS_AS_MISSOES) {
      for (const id of m.requer) expect(NO_POR_ID.get(id)?.disponivel, `${m.id} → ${id}`).toBe(true);
    }
  });

  it('situação do nó', () => {
    const possui = new Set([RAIZ]);
    expect(situacaoDoNo(NO_POR_ID.get(RAIZ)!, possui, 0)).toBe('possui');
    expect(situacaoDoNo(NO_POR_ID.get('leitura-rapida')!, possui, 0)).toBe('sem-carimbos');
    expect(situacaoDoNo(NO_POR_ID.get('leitura-rapida')!, possui, 2)).toBe('compravel');
    expect(situacaoDoNo(NO_POR_ID.get('despacho-em-lote')!, possui, 99)).toBe('bloqueado');
    expect(situacaoDoNo(NO_POR_ID.get('expurgo')!, possui, 99)).toBe('lacrado');
  });

  it('verificador bloqueia com o nome da credencial', () => {
    const verificar = criarVerificador(() => new Set([RAIZ]));
    expect(() => verificar({ metodo: 'find', args: [{ setor: 'Limbo' }] })).not.toThrow();
    expect(() => verificar({ metodo: 'find', args: [{ anos: { $gt: 3 } }] })).toThrow(CredencialError);
    try {
      verificar({ metodo: 'findOne', args: [] });
    } catch (e) {
      expect((e as CredencialError).credencial).toBe('Leitura Rápida');
    }
    expect(NO_POR_CHAVE.get('$sort@agregacao')!.id).toBe('esteira');
  });
});
