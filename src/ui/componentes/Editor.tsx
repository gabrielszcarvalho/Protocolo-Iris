import { useEffect, useRef } from 'react';
import { EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  completionStatus,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import { HighlightStyle, bracketMatching, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export interface Sugestoes {
  colecoes: string[];
  metodosColecao: string[];
  metodosCursor: string[];
  operadores: string[];
  campos: string[];
}

interface Props {
  aoExecutar: (texto: string) => void;
  aoMudar: (texto: string) => void;
  historico: () => string[];
  sugestoes: () => Sugestoes;
  pedido?: { id: number; texto: string };
}

const cores = HighlightStyle.define([
  { tag: t.keyword, color: '#e0a96d' },
  { tag: [t.string, t.special(t.string)], color: '#b8d98a' },
  { tag: t.regexp, color: '#f2c572' },
  { tag: [t.number, t.bool, t.null], color: '#e89a8a' },
  { tag: t.propertyName, color: '#9ccfd8' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#f0e6c8' },
  { tag: t.variableName, color: '#d8e0c8' },
  { tag: t.comment, color: '#7d8676', fontStyle: 'italic' },
  { tag: t.punctuation, color: '#a7b09c' },
]);

const tema = EditorView.theme(
  {
    '&': { color: '#d8e0c8', backgroundColor: 'transparent', fontSize: '15px', height: '100%' },
    '.cm-content': { fontFamily: 'var(--mono)', caretColor: '#9fd49a', padding: '10px 0' },
    '.cm-line': { padding: '0 14px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor': { borderLeftColor: '#9fd49a', borderLeftWidth: '2px' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: '#3b4a3d !important' },
    '.cm-placeholder': { color: '#6c7566' },
    '.cm-matchingBracket': { backgroundColor: '#3b4a3d', color: '#fff' },
    '.cm-tooltip': { border: '1px solid #3b443c', backgroundColor: '#20261f', color: '#d8e0c8' },
    '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--mono)', maxHeight: '14em' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#4d5b43', color: '#fff' },
    '.cm-completionDetail': { color: '#8c9681', fontStyle: 'normal', marginLeft: '1em' },
  },
  { dark: true },
);

function fonteDeSugestoes(obter: () => Sugestoes) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const trecho = ctx.matchBefore(/[\w$.]*$/);
    if (!trecho) return null;
    const texto = trecho.text;
    if (!texto && !ctx.explicit) return null;
    const s = obter();
    const anterior = ctx.state.sliceDoc(Math.max(0, trecho.from - 1), trecho.from);
    let m: RegExpExecArray | null;

    if ((m = /^db\.(\w*)$/.exec(texto))) {
      return { from: trecho.to - m[1].length, options: s.colecoes.map((label) => ({ label, type: 'variable', detail: 'coleção' })), validFor: /^\w*$/ };
    }
    if ((m = /^db\.\w+\.(\w*)$/.exec(texto))) {
      return { from: trecho.to - m[1].length, options: s.metodosColecao.map((label) => ({ label, type: 'method', detail: 'método' })), validFor: /^\w*$/ };
    }
    if ((m = /^\.(\w*)$/.exec(texto)) && anterior === ')') {
      return { from: trecho.to - m[1].length, options: s.metodosCursor.map((label) => ({ label, type: 'method', detail: 'cursor' })), validFor: /^\w*$/ };
    }
    if ((m = /(\$\w*)$/.exec(texto))) {
      return { from: trecho.to - m[1].length, options: s.operadores.map((label) => ({ label, type: 'keyword', detail: 'operador' })), validFor: /^\$?\w*$/ };
    }
    if (/^d?b?$/.test(texto) && texto) {
      return { from: trecho.from, options: [{ label: 'db', type: 'variable', detail: 'banco iris' }] };
    }
    if (/^[a-z_][\w.]*$/i.test(texto) && /[{,\s'"]/.test(anterior)) {
      return { from: trecho.from, options: s.campos.map((label) => ({ label, type: 'property', detail: 'campo' })), validFor: /^[\w.]*$/ };
    }
    return null;
  };
}

export function Editor({ aoExecutar, aoMudar, historico, sugestoes, pedido }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const cb = useRef({ aoExecutar, aoMudar, historico, sugestoes });
  cb.current = { aoExecutar, aoMudar, historico, sugestoes };
  const posHistorico = useRef(-1);

  useEffect(() => {
    const substituir = (v: EditorView, texto: string) =>
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: texto }, selection: { anchor: texto.length } });

    const teclas = Prec.highest(
      keymap.of([
        {
          key: 'Mod-Enter',
          run: (v) => {
            posHistorico.current = -1;
            cb.current.aoExecutar(v.state.doc.toString());
            return true;
          },
        },
        {
          key: 'Mod-l',
          run: (v) => {
            substituir(v, '');
            return true;
          },
        },
        {
          key: 'ArrowUp',
          run: (v) => {
            if (completionStatus(v.state)) return false;
            if (v.state.doc.lineAt(v.state.selection.main.head).number !== 1) return false;
            const h = cb.current.historico();
            if (!h.length) return false;
            posHistorico.current = posHistorico.current === -1 ? h.length - 1 : Math.max(0, posHistorico.current - 1);
            substituir(v, h[posHistorico.current]);
            return true;
          },
        },
        {
          key: 'ArrowDown',
          run: (v) => {
            if (completionStatus(v.state) || posHistorico.current === -1) return false;
            if (v.state.doc.lineAt(v.state.selection.main.head).number !== v.state.doc.lines) return false;
            const h = cb.current.historico();
            posHistorico.current++;
            if (posHistorico.current >= h.length) {
              posHistorico.current = -1;
              substituir(v, '');
            } else substituir(v, h[posHistorico.current]);
            return true;
          },
        },
      ]),
    );

    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: '',
        extensions: [
          teclas,
          history(),
          closeBrackets(),
          bracketMatching(),
          javascript(),
          syntaxHighlighting(cores),
          autocompletion({ override: [fonteDeSugestoes(() => cb.current.sugestoes())], icons: false }),
          keymap.of([...closeBracketsKeymap, ...completionKeymap, ...historyKeymap, indentWithTab, ...defaultKeymap]),
          placeholder('Escreva um comando. Ex.: db.almas.find()'),
          tema,
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'Terminal de comandos', spellcheck: 'false' }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) cb.current.aoMudar(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    v.focus();
    return () => v.destroy();
  }, []);

  useEffect(() => {
    const v = view.current;
    if (!pedido || !v) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: pedido.texto }, selection: { anchor: pedido.texto.length } });
    v.focus();
  }, [pedido]);

  return <div className="editor" ref={host} onClick={() => view.current?.focus()} />;
}
