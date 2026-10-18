// register.tsx — o mod `progresso`: faixa acima do prompt com uma linha por plano vivo, painel
// /progresso com um cartão por plano (marca JP Labs v4.1: anel de %, barras no degradê do feixe, o
// feixe atravessando a barra ao abrir e ao fechar item), conferência de PR pelo gh e a regra de manter
// o progresso.md no prompt (só em projeto que tem um).

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Sprint } from '../types'
import { barra, estadoReal, linhasDaFaixa, parseProgresso, placar, quemVoce } from './parse'
import { ANEL, anelCells, barraCells } from './raster'

const PANE = 'progresso'
const sprints = atom({ plugin: 'progresso', key: 'sprints' } as const, [])
const prs = atom({ plugin: 'progresso', key: 'prs' } as const, {})

const RELER_MS = 10_000
const GH_MS = 5 * 60_000
const BARRA = 26 // colunas da barra de lote no painel
const QUADRO_MS = 33
const FEIXE_QUADROS = 36 // ~1,2s

// onde o mod procura: `progresso.md` na raiz, ou um por plano numa destas pastas
const PASTAS = ['plans', '.aios/plans/sprints']

const regra = (voce: string): string => [
  'Este projeto acompanha os planos em arquivos `progresso.md` (na raiz, ou em `plans/<plano>/`), que o usuário lê numa faixa acima do prompt e no /progresso.',
  `Mantenha-os verdadeiros no mesmo passo em que o estado muda: começou um item -> \`[~]\`; ficou esperando alguém -> \`[!]\` com \`quem: <${voce} | pessoa | data>\` no fim;`,
  'terminou -> `[x]` com a evidência na linha (`pr:N`, hash, data). Só marque `[x]` com teste ou prova feitos nesta sessão. Item novo que surgir entra no lote certo.',
].join(' ')

// marca JP Labs v4.1: 1 acento, âmbar só em ação
const C = {
  fundo: '#01010D', card: '#0E0E1A', borda: '#24203A', ink: '#EDEDEF', body: '#ABABB0', muted: '#838389',
  apagado: '#55555F', acento: '#9A73FF', claro: '#C9B6FF', ambar: '#F59E0B', erro: '#FF5C7A', trilho: '#2A2A3E',
}
const ICONE: Record<string, string> = { feito: '✓', andando: '◐', esperando: '⏳', falta: '○', diverge: '✗' }

// estado do módulo: recomeça a cada carga, o que importa fica em $.state
let raiz = ''
let voce = quemVoce()
let repoOk = true
let feitosAntes: Record<string, number> = {}
let animando: { cancel: () => void } | null = null

const chaveBarra = (pasta: string, lote: number) => `barra:${pasta}:${lote}`
const chaveAnel = (pasta: string) => `anel:${pasta}`

/** O feixe atravessa a barra do lote em curso de cada sprint em `alvo`, e o anel enche até o %. */
function feixeNoPainel($: EngineInterface, alvo: readonly Sprint[], mapa: Readonly<Record<string, string>>, encherAnel: boolean): void {
  animando?.cancel()
  const passos = alvo.map((s) => {
    const p = placar(s, mapa, voce)
    const li = p.lotes.findIndex((l) => l.feitos < l.total)
    const lote = li >= 0 ? p.lotes[li] : p.lotes[p.lotes.length - 1]
    const pct = p.total === 0 ? 0 : (p.feitos / p.total) * 100
    return { s, li: li >= 0 ? li : p.lotes.length - 1, lote, pct }
  })
  let q = 0
  const timer = $.clock.every(QUADRO_MS, () => {
    q++
    const t = Math.min(1, q / FEIXE_QUADROS)
    for (const x of passos) {
      if (x.lote) {
        const cheio = x.lote.total === 0 ? 0 : Math.round((x.lote.feitos / x.lote.total) * BARRA)
        const brilho = t >= 1 || cheio === 0 ? null : Math.floor(t * (cheio + 2)) - 1
        void $.ui.blit({ requestId: PANE, key: chaveBarra(x.s.pasta, x.li), columns: BARRA, rows: 1, cells: barraCells(x.lote.feitos, x.lote.total, BARRA, brilho) })
      }
      if (encherAnel) {
        const e = 1 - Math.pow(1 - t, 3) // ease-out
        void $.ui.blit({ requestId: PANE, key: chaveAnel(x.s.pasta), columns: ANEL.colunas, rows: ANEL.linhas, cells: anelCells(x.pct * e) })
      }
    }
    if (t >= 1) { timer.cancel(); if (animando === timer) animando = null }
  })
  animando = timer
}

async function reler($: EngineInterface): Promise<void> {
  if (raiz === '') return
  const achados = [{ nome: raiz.split(/[\\/]/).filter(Boolean).pop() ?? 'projeto', arq: `${raiz}/progresso.md` }]
  for (const pasta of PASTAS) {
    const base = `${raiz}/${pasta}`
    const dentro = (await $.fs.list(base).catch(() => [])).filter((p) => p.kind === 'dir')
    for (const p of dentro) achados.push({ nome: p.name, arq: `${base}/${p.name}/progresso.md` })
  }
  const lidos: Sprint[] = []
  for (const { nome, arq } of achados) {
    const st = await $.fs.stat(arq).catch(() => undefined)
    if (st === undefined) continue
    const texto = await $.fs.read(arq).catch(() => '')
    lidos.push(parseProgresso(nome, texto, st.mtimeMs))
  }
  await update($, sprints, () => lidos)
  // item que fechou desde a última leitura: o feixe passa na barra daquele sprint
  const mapa = await read($, prs)
  const agora: Record<string, number> = {}
  const subiram: Sprint[] = []
  for (const s of lidos) {
    agora[s.pasta] = placar(s, mapa, voce).feitos
    const antes = feitosAntes[s.pasta]
    if (antes !== undefined && (agora[s.pasta] ?? 0) > antes) subiram.push(s)
  }
  feitosAntes = agora
  if (subiram.length > 0) feixeNoPainel($, subiram, mapa, false)
}

async function conferePRs($: EngineInterface): Promise<void> {
  if (raiz === '' || !repoOk) return
  const lista = await read($, sprints)
  if (!lista.some((s) => s.lotes.some((l) => l.itens.some((i) => i.pr !== null)))) return
  const r = await $.process
    .run(['gh', 'pr', 'list', '--state', 'all', '--limit', '300', '--json', 'number,state'], { cwd: raiz })
    .catch(() => undefined)
  if (r === undefined) return
  if (r.exitCode !== 0) {
    repoOk = false // sem gh ou repo sem GitHub: para de tentar nesta carga
    return
  }
  try {
    const arr = JSON.parse(r.stdout) as Array<{ number: number; state: string }>
    const mapa: Record<string, string> = {}
    for (const x of arr) mapa[String(x.number)] = x.state
    await update($, prs, () => mapa)
  } catch {
    // saída que não é JSON: fica a última leitura
  }
}

export const register: Register = (on, options) => {
  const nome = typeof options.nome === 'string' ? options.nome.trim() : ''
  voce = quemVoce(nome)
  const REGRA = regra(nome || 'você')

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'progresso', description: 'Abre o painel com o que foi feito e o que falta de cada PRD' })
    raiz = await $.session.root()
    await reler($)
    await conferePRs($)
    $.clock.every(RELER_MS, () => { void reler($) })
    $.clock.every(GH_MS, () => { void conferePRs($) })
    return next(e)
  })

  on('command.run', { command: 'progresso' }, async $ => {
    await reler($)
    await conferePRs($)
    const lista = await read($, sprints)
    if (lista.length === 0) return { text: 'Nenhum progresso.md neste projeto. Peça pro Claude montar o plano: ele cria o progresso.md e a faixa aparece.' }
    await $.ui.open({ id: PANE, title: 'Progresso dos PRDs' })
    const mapa = await read($, prs)
    // o painel monta no próximo quadro: o feixe começa logo depois
    $.clock.after(120, () => feixeNoPainel($, lista.filter((s) => !placar(s, mapa, voce).completo), mapa, true))
    return { text: 'Painel de progresso aberto.' }
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if ((await read($, sprints)).length === 0) return r
    return { sections: [...r.sections, { id: 'progresso:regra', text: REGRA, scope: 'session' }] }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { linhas, resto } = linhasDaFaixa(await read($, sprints), await read($, prs), voce)
    if (linhas.length === 0) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const largura = Math.max(...linhas.map((l) => l.nome.length))
    return (
      <Box flexDirection="column">
        {linhas.map((l, i) => {
          const b = l.lote ? barra(l.lote.feitos, l.lote.total, 10) : barra(l.feitos, l.total, 10)
          return (
            <Text key={l.nome} wrap="truncate-end">
              <Text color={C.acento}>{l.ativo ? '▸ ' : '  '}</Text>
              <Text color={l.ativo ? C.ink : C.body} weight={l.ativo ? 'bold' : 'regular'}>{l.nome.padEnd(largura)}</Text>
              {'  '}
              {l.lote ? <Text color={C.muted}>{l.lote.nome} </Text> : null}
              <Text color={C.acento}>{b.cheio}</Text>
              <Text color={C.trilho}>{b.vazio}</Text>
              <Text color={C.muted}> {l.lote ? `${l.lote.feitos}/${l.lote.total}` : ''} · {l.feitos}/{l.total}</Text>
              {l.esperandoVoce > 0 ? <Text color={C.ambar} weight="bold">  ⏳ {l.esperandoVoce} esperando você</Text> : null}
              {l.esperandoOutro ? <Text color={C.muted}>  ⏳ {l.esperandoOutro.n} {l.esperandoOutro.quem}</Text> : null}
              {l.diverge > 0 ? <Text color={C.erro}>  ✗ {l.diverge} diverge</Text> : null}
              {l.proximo ? <Text color={C.body}>  › {l.proximo}</Text> : null}
              {i === linhas.length - 1 && resto > 0 ? <Text color={C.muted}>  +{resto}</Text> : null}
            </Text>
          )
        })}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const el = $.ui.resolve(e)
    const { Box, Text } = el
    const Raster = 'Raster' in el ? el.Raster : null // só o terminal tem; nos outros, o painel fica sem anel e barra
    const mapa = await read($, prs)
    const lista = [...(await read($, sprints))].sort((a, b) => {
      const pa = placar(a, mapa, voce), pb = placar(b, mapa, voce)
      return Number(pa.completo) - Number(pb.completo) || Number(pb.ativo) - Number(pa.ativo) || b.mtimeMs - a.mtimeMs
    })
    if (lista.length === 0) {
      return (
        <Box backgroundColor={C.fundo} paddingX={1}>
          <Text color={C.muted}>Nenhum progresso.md neste projeto.</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column" backgroundColor={C.fundo} paddingX={1} paddingY={1}>
        {lista.map((s) => {
          const p = placar(s, mapa, voce)
          const pct = p.total === 0 ? 0 : (p.feitos / p.total) * 100
          const emCurso = p.lotes.find((l) => l.feitos < l.total)
          const outros = Object.entries(p.esperandoOutros).sort((a, b) => b[1] - a[1])
          return (
            <Box key={s.pasta} flexDirection="column" backgroundColor={C.card} borderStyle="round" borderColor={p.ativo ? C.acento : C.borda} paddingX={2} paddingY={1} marginBottom={1}>
              <Box flexDirection="row">
                {Raster ? <Raster key={chaveAnel(s.pasta)} columns={ANEL.colunas} rows={ANEL.linhas} cells={anelCells(pct)} /> : null}
                <Box flexDirection="column" paddingLeft={2} justifyContent="center">
                  <Text color={C.ink} weight="bold" wrap="truncate-end">{s.titulo}</Text>
                  <Text color={C.body}>
                    {p.feitos} de {p.total}{p.completo ? '  ·  completo' : emCurso ? `  ·  ${emCurso.nome} em curso` : ''}
                  </Text>
                  {p.esperandoVoce > 0 ? <Text color={C.ambar} weight="bold">⏳ {p.esperandoVoce} esperando você</Text> : null}
                  {outros.length > 0 ? <Text color={C.muted} wrap="truncate-end">⏳ {outros.map(([q, n]) => `${n} ${q}`).join(' · ')}</Text> : null}
                  {p.diverge > 0 ? <Text color={C.erro}>✗ {p.diverge} diverge do GitHub</Text> : null}
                </Box>
              </Box>
              {p.completo ? null : s.lotes.map((l, li) => {
                const pl = p.lotes[li]
                const feitos = pl?.feitos ?? 0, total = pl?.total ?? 0
                const fechado = total > 0 && feitos === total
                return (
                  <Box key={`${s.pasta}/${l.nome}`} flexDirection="column" marginTop={1}>
                    <Box flexDirection="row">
                      <Text color={fechado ? C.muted : C.ink} weight="bold">{l.nome.padEnd(28).slice(0, 28)} </Text>
                      {Raster ? <Raster key={chaveBarra(s.pasta, li)} columns={BARRA} rows={1} cells={barraCells(feitos, total, BARRA)} /> : null}
                      <Text color={C.muted}>  {feitos}/{total}</Text>
                    </Box>
                    {l.itens.map((it, i) => {
                      const est = estadoReal(it, mapa)
                      const st = it.pr === null ? undefined : mapa[String(it.pr)]
                      const daVoce = est === 'esperando' && it.quem !== null && voce.test(it.quem)
                      const corIcone = est === 'feito' ? C.acento : est === 'andando' ? C.claro : est === 'diverge' ? C.erro : est === 'esperando' ? (daVoce ? C.ambar : C.body) : C.apagado
                      const corTexto = est === 'feito' ? C.muted : est === 'diverge' ? C.erro : est === 'andando' ? C.ink : C.body
                      return (
                        <Text key={`${s.pasta}/${l.nome}/${i}`} wrap="truncate-end">
                          <Text color={corIcone}>  {ICONE[est]}  </Text>
                          <Text color={corTexto} weight={est === 'andando' ? 'bold' : 'regular'}>{it.texto}</Text>
                          {it.pr !== null ? <Text color={st === 'MERGED' ? C.acento : C.muted}>  #{it.pr}</Text> : null}
                          {it.quem !== null && est !== 'feito' ? <Text color={daVoce ? C.ambar : C.muted}>  {it.quem}</Text> : null}
                        </Text>
                      )
                    })}
                  </Box>
                )
              })}
            </Box>
          )
        })}
      </Box>
    )
  })
}
