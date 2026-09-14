import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useControlador } from '../controlador';
import { som } from '../som';

const CARTAS = [
  { rotulo: 'Diário Oficial do Além · Edital nº 1/1953', texto: 'Parabéns! Sua aprovação no concurso público mais disputado do além acaba de ser publicada.' },
  { rotulo: 'Cargo', texto: 'Arquivista-Chefe do Departamento de Almas Extraviadas: a repartição que registra quem partiu deixando assuntos pendentes.' },
  { rotulo: 'Situação do setor', texto: 'Em 1953, o arquivo de papel pegou fogo. O que sobrou foi digitado às pressas num banco de dados MongoDB. Com muitos erros.' },
  { rotulo: 'Instruções', texto: 'Seu antecessor sumiu sem deixar relatório. Você recebe uma credencial provisória, um terminal e uma fila de almas esperando.' },
];

const VELOCIDADE = 28; // ms por letra

export function Abertura() {
  const c = useControlador();
  const [indice, setIndice] = useState(0);
  const [letras, setLetras] = useState(0);
  const carta = CARTAS[indice];
  const completa = letras >= carta.texto.length;
  const ultima = indice === CARTAS.length - 1;

  useEffect(() => {
    if (completa) return;
    const t = setTimeout(() => {
      setLetras((n) => n + 1);
      if (letras % 3 === 0 && carta.texto[letras] !== ' ') som.tecla();
    }, VELOCIDADE);
    return () => clearTimeout(t);
  }, [letras, completa, carta.texto]);

  const avancar = () => {
    if (!completa) return setLetras(carta.texto.length);
    if (ultima) return c.concluirAbertura();
    setIndice((i) => i + 1);
    setLetras(0);
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') c.concluirAbertura();
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        avancar();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  useEffect(() => {
    if (ultima && completa) {
      const t = setTimeout(() => som.carimbo(), 250);
      return () => clearTimeout(t);
    }
  }, [ultima, completa]);

  return (
    <main className="tela-abertura" onClick={avancar}>
      <button
        className="abertura-pular"
        onClick={(e) => {
          e.stopPropagation();
          c.concluirAbertura();
        }}
      >
        Pular (Esc)
      </button>

      {/* Sem esperar animação de saída: a troca de carta é imediata mesmo com a aba em segundo plano. */}
      <AnimatePresence initial={false}>
        <motion.article
          key={indice}
          className="abertura-carta papel"
          initial={{ opacity: 0.4, y: 16, rotate: -1.5 }}
          animate={{ opacity: 1, y: 0, rotate: indice % 2 ? 0.8 : -0.6 }}
          transition={{ duration: 0.35 }}
        >
          <p className="abertura-rotulo">{carta.rotulo}</p>
          <p className="abertura-texto">
            {carta.texto.slice(0, letras)}
            <span className="cursor-maquina" aria-hidden>
              {completa ? '' : '▌'}
            </span>
          </p>

          {ultima && completa && (
            <motion.div
              className="carimbo-grande"
              initial={{ scale: 2.6, opacity: 0, rotate: -24 }}
              animate={{ scale: 1, opacity: 1, rotate: -12 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.15 }}
            >
              Empossado
            </motion.div>
          )}

          <footer className="abertura-rodape">
            <span className="abertura-pontos">
              {CARTAS.map((_, i) => (
                <i key={i} className={i === indice ? 'ativo' : ''} />
              ))}
            </span>
            <span>{completa ? (ultima ? 'Clique para assumir o posto' : 'Clique para continuar') : ''}</span>
          </footer>
        </motion.article>
      </AnimatePresence>
    </main>
  );
}
