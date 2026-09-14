import type { Capitulo, Missao } from './tipos';
import { validarConsulta } from '../validacao';
import { nenhumaDeFora, objetivo, todasSao } from '../objetivos';
import { lerCaminho } from '../../engine/bson';

type Doc = Record<string, unknown>;
const texto = (d: Doc, campo: string) => {
  const v = lerCaminho(d, campo);
  return typeof v === 'string' ? v : undefined;
};
const casa = (regex: RegExp, campo: string) => (d: Doc) => {
  const v = texto(d, campo);
  return v !== undefined && regex.test(v);
};

/** Missão de grafologia padrão: consulta, dois quadradinhos (só as certas / nenhuma de fora). */
function grafologia(dados: Omit<Missao, 'tipo' | 'validar' | 'objetivos'> & { colecao: string; condicao: (d: Doc) => boolean; descricao: string }): Missao {
  const { colecao, condicao, descricao, ...resto } = dados;
  return {
    ...resto,
    tipo: 'consulta',
    validar: validarConsulta({ colecao }),
    objetivos: [objetivo(`Somente ${descricao}.`, todasSao(condicao, colecao)), objetivo('Nenhuma que se encaixe ficou de fora.', nenhumaDeFora(colecao))],
  };
}

export const capitulo6: Capitulo = {
  numero: 6,
  titulo: 'Grafologia',
  fase: 3,
  abertura:
    'Doze fichas chegaram escritas por um médium com a mão tremendo: protocolos tortos, nomes em caixa alta, e-mails com letra trocada. A Grafologia do Além ensina a achar padrões de texto — as expressões regulares.',
  missoes: [
    grafologia({
      id: '6.1',
      titulo: 'Âncoras',
      assunto: 'Protocolos da década de 1900 terminados em 7',
      corpo: 'Traga as almas cujo `protocolo` COMEÇA com `A-19` e TERMINA com o dígito `7`, com qualquer coisa no meio.',
      colecao: 'almas',
      descricao: 'protocolos que começam com A-19 e terminam com 7',
      condicao: casa(/^A-19.*7$/, 'protocolo'),
      requer: ['grafologia'],
      solucaoReferencia: 'db.almas.find({ protocolo: /^A-19.*7$/ })',
      solucoesErradas: [
        { codigo: 'db.almas.find({ protocolo: /A-19.*7/ })', porque: 'sem âncoras, casa no meio do texto' },
        { codigo: 'db.almas.find({ protocolo: /^A-19.7$/ })', porque: 'o ponto sozinho é UM caractere só' },
      ],
      dicas: ['Regex vai entre barras: { campo: /padrao/ }. Sem âncoras, o padrão pode aparecer em qualquer lugar do texto.', '^ marca o começo e $ o fim. .* significa "qualquer coisa, de qualquer tamanho".', 'db.almas.find({ protocolo: /^A-19.*7$/ })'],
      recompensa: 3,
      licao: '^ ancora no começo, $ no fim; . é qualquer caractere e * repete zero ou mais vezes.',
    }),
    grafologia({
      id: '6.2',
      titulo: 'Rabo de dígitos',
      assunto: 'Sequência numérica completa',
      corpo: 'Um protocolo bem terminado acaba com uma sequência de PELO MENOS 4 dígitos. Traga as almas cujo `protocolo` termina assim.',
      colecao: 'almas',
      descricao: 'protocolos terminados em 4 ou mais dígitos',
      condicao: casa(/\d{4,}$/, 'protocolo'),
      requer: ['grafologia'],
      solucaoReferencia: 'db.almas.find({ protocolo: /\\d{4,}$/ })',
      solucoesErradas: [
        { codigo: 'db.almas.find({ protocolo: /\\d{4}/ })', porque: 'sem $, aceita dígitos no meio' },
        { codigo: 'db.almas.find({ protocolo: /\\d$/ })', porque: 'um dígito só no fim' },
      ],
      dicas: ['\\d é "um dígito". Repetições vão entre chaves.', '{4,} significa "4 ou mais vezes". E o fim do texto é $.', 'db.almas.find({ protocolo: /\\d{4,}$/ })'],
      recompensa: 3,
      licao: '\\d é um dígito; {n,} repete n ou mais vezes.',
    }),
    grafologia({
      id: '6.3',
      titulo: 'Classes negadas',
      assunto: 'Protocolos de letra estranha',
      corpo: 'Todo protocolo deveria começar com `A` ou `B` maiúsculo. Traga as almas cujo `protocolo` começa com QUALQUER outro caractere (inclusive espaço, número ou letra minúscula).',
      colecao: 'almas',
      descricao: 'protocolos que não começam com A nem B',
      condicao: casa(/^[^AB]/, 'protocolo'),
      requer: ['grafologia'],
      solucaoReferencia: 'db.almas.find({ protocolo: /^[^AB]/ })',
      solucoesErradas: [
        { codigo: 'db.almas.find({ protocolo: /[^AB]/ })', porque: 'sem ^, qualquer caractere que não seja A ou B serve' },
        { codigo: 'db.almas.find({ protocolo: /^[^A]/ })', porque: 'esqueceu o B' },
      ],
      dicas: ['Colchetes definem uma classe: [AB] é "A ou B".', 'Com ^ DENTRO dos colchetes a classe é negada: [^AB] é "qualquer coisa exceto A e B". O ^ de fora ancora no começo.', 'db.almas.find({ protocolo: /^[^AB]/ })'],
      recompensa: 3,
      licao: '[AB] casa um destes caracteres; [^AB] casa qualquer um que não seja estes.',
    }),
    grafologia({
      id: '6.4',
      titulo: 'Alternância',
      assunto: 'Carimbadores e mensageiros',
      corpo: 'Traga os arquivistas cuja `funcao` é EXATAMENTE `Carimbador` ou EXATAMENTE `Mensageiro` — num padrão só, sem $in. Carimbador-Auxiliar e Mensageiro Noturno não entram.',
      colecao: 'arquivistas',
      descricao: 'arquivistas com função exatamente Carimbador ou Mensageiro',
      condicao: casa(/^(Carimbador|Mensageiro)$/, 'funcao'),
      requer: ['grafologia'],
      solucaoReferencia: 'db.arquivistas.find({ funcao: /^(Carimbador|Mensageiro)$/ })',
      solucoesErradas: [
        { codigo: 'db.arquivistas.find({ funcao: /Carimbador|Mensageiro/ })', porque: 'sem âncoras, casa Carimbador-Auxiliar' },
        { codigo: 'db.arquivistas.find({ funcao: /^Carimbador|Mensageiro$/ })', porque: 'sem parênteses, as âncoras ficam só em uma ponta de cada' },
      ],
      dicas: ['| significa "ou" dentro de um padrão.', 'Parênteses agrupam: ^(a|b)$ exige que o texto inteiro seja a ou b.', 'db.arquivistas.find({ funcao: /^(Carimbador|Mensageiro)$/ })'],
      recompensa: 4,
      licao: 'a|b casa a ou b; parênteses delimitam até onde vai a alternância.',
    }),
    grafologia({
      id: '6.5',
      titulo: 'Formato oficial',
      assunto: 'Protocolos dentro da norma',
      corpo: 'O formato oficial é: uma letra MAIÚSCULA, hífen, 4 dígitos, hífen, 4 dígitos — e nada mais antes ou depois. Traga as almas com protocolo nesse formato.',
      colecao: 'almas',
      descricao: 'protocolos no formato oficial',
      condicao: casa(/^[A-Z]-\d{4}-\d{4}$/, 'protocolo'),
      requer: ['grafologia'],
      solucaoReferencia: 'db.almas.find({ protocolo: /^[A-Z]-\\d{4}-\\d{4}$/ })',
      solucoesErradas: [
        { codigo: 'db.almas.find({ protocolo: /[A-Z]-\\d{4}-\\d{4}/ })', porque: 'sem âncoras, aceita lixo antes e depois' },
        { codigo: 'db.almas.find({ protocolo: /^[A-Z]-\\d+-\\d+$/ })', porque: '+ aceita qualquer quantidade de dígitos' },
      ],
      dicas: ['Monte por partes: uma letra maiúscula, hífen, dígitos...', '[A-Z] é uma letra maiúscula; \\d{4} são exatamente 4 dígitos. Não esqueça ^ e $.', 'db.almas.find({ protocolo: /^[A-Z]-\\d{4}-\\d{4}$/ })'],
      recompensa: 4,
      licao: '[A-Z] é um intervalo de caracteres; {n} exige exatamente n repetições.',
    }),
    grafologia({
      id: '6.6',
      titulo: 'O ponto traiçoeiro',
      assunto: 'E-mails oficiais',
      corpo: 'Traga os arquivistas cujo e-mail (`contato.email`) termina em `@iris.gov`, sem se importar com maiúsculas. Cuidado: `@irisXgov` e `@iris.gov.br` NÃO são oficiais.',
      colecao: 'arquivistas',
      descricao: 'e-mails terminados em @iris.gov (qualquer caixa)',
      condicao: casa(/@iris\.gov$/i, 'contato.email'),
      requer: ['grafologia'],
      solucaoReferencia: "db.arquivistas.find({ 'contato.email': /@iris\\.gov$/i })",
      solucoesErradas: [
        { codigo: "db.arquivistas.find({ 'contato.email': /@iris.gov$/i })", porque: 'o ponto sem escape casa qualquer caractere' },
        { codigo: "db.arquivistas.find({ 'contato.email': /@iris\\.gov$/ })", porque: 'sem a flag i, @Iris.Gov fica de fora' },
      ],
      dicas: ['Na regex, o ponto é um curinga. Teste /@iris.gov$/ e veja quem aparece.', '\\. é um ponto de verdade. A flag i (depois da barra final) ignora maiúsculas — equivale a $options: "i".', "db.arquivistas.find({ 'contato.email': /@iris\\.gov$/i })"],
      recompensa: 4,
      licao: '\\. é o ponto literal; a flag i (ou $options: "i") ignora maiúsculas e minúsculas.',
    }),
    grafologia({
      id: '6.7',
      titulo: 'Sobrenomes compostos',
      assunto: 'Famílias tradicionais do além',
      corpo: 'Traga as almas cujo `nome` tem uma partícula `da`, `de`, `do`, `das` ou `dos` como palavra separada (com espaço antes e depois), em minúsculas.',
      colecao: 'almas',
      descricao: 'nomes com da/de/do/das/dos entre espaços',
      condicao: casa(/\sd[aeo]s?\s/, 'nome'),
      requer: ['grafologia'],
      solucaoReferencia: 'db.almas.find({ nome: /\\sd[aeo]s?\\s/ })',
      solucoesErradas: [
        { codigo: 'db.almas.find({ nome: /d[aeo]s?/ })', porque: 'sem os espaços, casa "Valdemar" e "Deolindo"' },
        { codigo: 'db.almas.find({ nome: /\\sd[aeo]\\s/ })', porque: 'esqueceu o plural (das, dos)' },
      ],
      dicas: ['\\s é um espaço (ou tab). A partícula precisa estar entre dois deles.', 'd[aeo] casa da, de, do; s? torna o s opcional.', 'db.almas.find({ nome: /\\sd[aeo]s?\\s/ })'],
      recompensa: 3,
      licao: '\\s casa espaço; ? torna o caractere anterior opcional.',
    }),
    grafologia({
      id: '6.8',
      titulo: 'Usuário oficial',
      assunto: 'E-mails no padrão nome.sobrenome',
      corpo: 'O usuário do e-mail (antes do `@`) deveria ser `nome.sobrenome`: letras, um ponto, letras. Traga os arquivistas cujo `contato.email` COMEÇA assim e logo depois vem o `@`.',
      colecao: 'arquivistas',
      descricao: 'e-mails que começam com palavra.palavra@',
      condicao: casa(/^\w+\.\w+@/, 'contato.email'),
      requer: ['grafologia'],
      solucaoReferencia: "db.arquivistas.find({ 'contato.email': /^\\w+\\.\\w+@/ })",
      solucoesErradas: [
        { codigo: "db.arquivistas.find({ 'contato.email': /\\w+\\.\\w+/ })", porque: 'sem ^ e @, casa o domínio iris.gov' },
        { codigo: "db.arquivistas.find({ 'contato.email': /^\\w+@/ })", porque: 'esqueceu o ponto no meio' },
      ],
      dicas: ['\\w é letra, número ou sublinhado. Um ou mais: +.', 'O ponto literal é \\. e o padrão começa no início do texto.', "db.arquivistas.find({ 'contato.email': /^\\w+\\.\\w+@/ })"],
      recompensa: 3,
      licao: '\\w casa letra, número ou _; + repete uma ou mais vezes.',
    }),
    grafologia({
      id: '6.9',
      titulo: 'Ramal válido',
      assunto: 'Ramais dos chefes',
      corpo: 'Um ramal válido tem de 3 a 4 dígitos, e nada mais. Traga os arquivistas cujo `contato.ramal` é válido.',
      colecao: 'arquivistas',
      descricao: 'ramais com 3 ou 4 dígitos',
      condicao: casa(/^\d{3,4}$/, 'contato.ramal'),
      requer: ['grafologia'],
      solucaoReferencia: "db.arquivistas.find({ 'contato.ramal': /^\\d{3,4}$/ })",
      solucoesErradas: [
        { codigo: "db.arquivistas.find({ 'contato.ramal': /\\d{3,4}/ })", porque: 'sem âncoras, aceita 00042 e r-311' },
        { codigo: "db.arquivistas.find({ 'contato.ramal': /^\\d{4}$/ })", porque: 'só 4 dígitos' },
      ],
      dicas: ['Faixa de repetições também vai entre chaves.', '{3,4} significa "de 3 a 4 vezes". Ancore com ^ e $.', "db.arquivistas.find({ 'contato.ramal': /^\\d{3,4}$/ })"],
      recompensa: 4,
      licao: '{n,m} repete de n a m vezes.',
    }),
    {
      id: '6.10',
      titulo: 'Selo por extenso',
      assunto: 'Condecorados por mérito',
      corpo: 'Traga os arquivistas que têm algum selo (no array `selos`) cujo `nome` começa com `Mérito`.',
      objetivos: [
        objetivo('Somente arquivistas com um selo que começa com Mérito.', todasSao((d) => ((d.selos as { nome: string }[]) ?? []).some((s) => /^Mérito/.test(s.nome)), 'arquivistas')),
        objetivo('Nenhum ficou de fora.', nenhumaDeFora('arquivistas')),
      ],
      requer: ['grafologia'],
      tipo: 'consulta',
      validar: validarConsulta({ colecao: 'arquivistas' }),
      solucaoReferencia: 'db.arquivistas.find({ selos: { $elemMatch: { nome: /^Mérito/ } } })',
      solucoesErradas: [
        { codigo: "db.arquivistas.find({ 'selos.nome': 'Mérito' })", porque: 'igualdade exata em vez de padrão' },
        { codigo: 'db.arquivistas.find({ selos: /^Mérito/ })', porque: 'selos são subdocumentos, não textos' },
      ],
      dicas: ['Os selos são subdocumentos { nome, ano }. A regex precisa ser aplicada ao campo nome de algum deles.', '$elemMatch: { nome: /padrao/ } aplica a regex a cada selo.', 'db.arquivistas.find({ selos: { $elemMatch: { nome: /^Mérito/ } } })'],
      recompensa: 3,
      licao: 'Regex funciona dentro de $elemMatch (ou com dot notation "selos.nome") para buscar em arrays de subdocumentos.',
    },
    grafologia({
      id: '6.11',
      titulo: 'Fora da norma',
      assunto: 'Lista para a Corregedoria',
      corpo: 'Traga as almas cujo `protocolo` NÃO segue o formato oficial (`^[A-Z]-\\d{4}-\\d{4}$`) — inclusive as que nem têm protocolo.',
      colecao: 'almas',
      descricao: 'almas fora do formato oficial de protocolo',
      condicao: (d) => !casa(/^[A-Z]-\d{4}-\d{4}$/, 'protocolo')(d),
      requer: ['negacao'],
      solucaoReferencia: 'db.almas.find({ protocolo: { $not: /^[A-Z]-\\d{4}-\\d{4}$/ } })',
      solucoesErradas: [
        { codigo: 'db.almas.find({ protocolo: /^[^A-Z]/ })', porque: 'só pegou quem começa errado' },
        { codigo: 'db.almas.find({ protocolo: { $not: /^[A-Z]-\\d{4}-\\d{4}$/ }, protocolo: { $exists: true } })', porque: 'excluiu quem não tem protocolo' },
      ],
      dicas: ['Escrever um padrão para "tudo que é errado" é difícil. Mais fácil é negar o padrão certo.', '{ campo: { $not: /padrao/ } } traz quem NÃO casa — incluindo quem nem tem o campo.', 'db.almas.find({ protocolo: { $not: /^[A-Z]-\\d{4}-\\d{4}$/ } })'],
      recompensa: 4,
      licao: '$not com regex traz o que não casa com o padrão, inclusive documentos sem o campo.',
    }),
  ],
};
