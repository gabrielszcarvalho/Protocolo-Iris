/**
 * Persistência em IndexedDB (API nativa, sem biblioteca).
 * Tudo é gravado em Extended JSON para preservar Date, ObjectId e RegExp.
 */

import { deEJSON, paraEJSON } from './bson';
import { Database, type SnapshotBanco } from './database';

const NOME_BANCO = 'protocolo-iris';
const LOJA = 'estado';
const VERSAO = 1;

export const CHAVES = {
  mundo: 'mundo',
  sandbox: 'sandbox',
  progresso: 'progresso',
  historicoComandos: 'historico-comandos',
} as const;

function pedido<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function abrir(fabrica: IDBFactory): Promise<IDBDatabase> {
  const req = fabrica.open(NOME_BANCO, VERSAO);
  req.onupgradeneeded = () => {
    if (!req.result.objectStoreNames.contains(LOJA)) req.result.createObjectStore(LOJA);
  };
  return pedido(req);
}

async function comLoja<T>(modo: IDBTransactionMode, fabrica: IDBFactory, fn: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const idb = await abrir(fabrica);
  try {
    const tx = idb.transaction(LOJA, modo);
    const resultado = await pedido(fn(tx.objectStore(LOJA)));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return resultado;
  } finally {
    idb.close();
  }
}

export class Armazenamento {
  constructor(private readonly fabrica: IDBFactory = globalThis.indexedDB) {}

  async salvar(chave: string, valor: unknown): Promise<void> {
    await comLoja('readwrite', this.fabrica, (loja) => loja.put(paraEJSON(valor), chave));
  }

  async carregar<T>(chave: string): Promise<T | undefined> {
    const bruto = await comLoja('readonly', this.fabrica, (loja) => loja.get(chave));
    return bruto === undefined ? undefined : (deEJSON(bruto) as T);
  }

  async remover(chave: string): Promise<void> {
    await comLoja('readwrite', this.fabrica, (loja) => loja.delete(chave));
  }

  async salvarBanco(chave: string, db: Database): Promise<void> {
    // O snapshot já está em EJSON; gravamos sem converter de novo.
    await comLoja('readwrite', this.fabrica, (loja) => loja.put(db.snapshot(), chave));
  }

  async carregarBanco(chave: string): Promise<Database | undefined> {
    const snap = await comLoja<SnapshotBanco | undefined>('readonly', this.fabrica, (loja) => loja.get(chave));
    return snap ? Database.restaurar(snap) : undefined;
  }
}
