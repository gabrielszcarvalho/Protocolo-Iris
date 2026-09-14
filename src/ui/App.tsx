import { useEffect } from 'react';
import { controlador, useControlador } from './controlador';
import { TelaTitulo } from './telas/TelaTitulo';
import { Abertura } from './telas/Abertura';
import { TelaJogo } from './telas/TelaJogo';

export function App() {
  const c = useControlador();

  useEffect(() => {
    void controlador.iniciar();
  }, []);

  switch (c.tela) {
    case 'carregando':
      return <div className="carregando">Acendendo as velas do arquivo…</div>;
    case 'titulo':
      return <TelaTitulo />;
    case 'abertura':
      return <Abertura />;
    case 'jogo':
      return <TelaJogo />;
  }
}
