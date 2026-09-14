import { useState } from 'react';
import { motion } from 'framer-motion';
import { useControlador } from '../controlador';

const FICHAS = Array.from({ length: 14 }, (_, i) => ({
  esquerda: (i * 37) % 100,
  atraso: (i * 1.7) % 12,
  duracao: 14 + ((i * 5) % 9),
  giro: ((i * 47) % 60) - 30,
}));

export function TelaTitulo() {
  const c = useControlador();
  const [confirmar, setConfirmar] = useState(false);
  const [sobre, setSobre] = useState(false);

  const novo = () => (c.temSave ? setConfirmar(true) : c.novoJogo());

  return (
    <main className="tela-titulo">
      <div className="titulo-luz" aria-hidden />
      <div className="titulo-fichas" aria-hidden>
        {FICHAS.map((f, i) => (
          <span
            key={i}
            style={{ left: `${f.esquerda}%`, animationDelay: `${-f.atraso}s`, animationDuration: `${f.duracao}s`, ['--giro' as string]: `${f.giro}deg` }}
          />
        ))}
      </div>

      <motion.header className="titulo-cabecalho" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9 }}>
        <p className="titulo-sobre">Departamento de Almas Extraviadas</p>
        <h1>
          Protocolo <em>Íris</em>
        </h1>
        <p className="titulo-lema">Um jogo sobre MongoDB, burocracia e almas com assuntos pendentes.</p>
      </motion.header>

      <motion.nav className="titulo-menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}>
        {c.temSave && (
          <button className="botao-titulo principal" onClick={() => c.continuar()} autoFocus>
            Continuar expediente
          </button>
        )}
        <button className={`botao-titulo ${c.temSave ? '' : 'principal'}`} onClick={novo} autoFocus={!c.temSave}>
          Novo expediente
        </button>
        <button className="botao-titulo" onClick={() => c.alternarSom()}>
          Som: {c.somLigado ? 'ligado' : 'desligado'}
        </button>
        <button className="botao-titulo" onClick={() => setSobre(true)}>
          Sobre o jogo
        </button>
      </motion.nav>

      <footer className="titulo-rodape">versão 0.2 · capítulos 1 a 3 · feito para a disciplina de Banco de Dados NoSQL</footer>

      {confirmar && (
        <div className="dialogo-fundo" onClick={() => setConfirmar(false)}>
          <div className="dialogo papel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <h2>Começar um novo expediente?</h2>
            <p>O progresso atual (carimbos, credenciais e memorandos) será perdido.</p>
            <div className="dialogo-acoes">
              <button className="botao" onClick={() => setConfirmar(false)} autoFocus>
                Cancelar
              </button>
              <button
                className="botao perigo"
                onClick={() => {
                  setConfirmar(false);
                  c.novoJogo();
                }}
              >
                Apagar e começar
              </button>
            </div>
          </div>
        </div>
      )}

      {sobre && (
        <div className="dialogo-fundo" onClick={() => setSobre(false)}>
          <div className="dialogo papel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <h2>Sobre o Protocolo Íris</h2>
            <p>
              Você escreve comandos reais do MongoDB. Eles rodam num banco de dados simulado dentro do seu navegador — nada é
              enviado para a internet, e o progresso fica salvo neste computador.
            </p>
            <p>
              Cumpra memorandos para ganhar carimbos, troque carimbos por credenciais e desbloqueie comandos novos, um de cada vez.
            </p>
            <div className="dialogo-acoes">
              <button className="botao" onClick={() => setSobre(false)} autoFocus>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
