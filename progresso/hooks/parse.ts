// parse.ts — o progresso.md virando dado, e o dado virando o placar. Puro: sem $.

import type { Estado, Item, Lote, Sprint } from '../types'

const MARCA: Record<string, Estado> = { ' ': 'falta', x: 'feito', X: 'feito', '~': 'andando', '!': 'esperando' }
const ITEM = /^\s*[-*]\s+\[([ xX~!])\]\s+(.*)$/
const PR = /\bpr:\s*#?(\d+)\b/i
const QUEM = /\bquem:\s*(.+)$/i

export function parseProgresso(pasta: string, texto: string, mtimeMs: number): Sprint {
  let titulo = pasta
  const lotes: Lote[] = []
  for (const linha of texto.split(/\r?\n/)) {
    const t = /^#\s+(?:Progresso:\s*)?(.+)$/.exec(linha)
    if (t && t[1]) { titulo = t[1].trim(); continue }
    const l = /^##\s+(.+)$/.exec(linha)
    if (l && l[1]) { lotes.push({ nome: l[1].trim(), itens: [] }); continue }
    const m = ITEM.exec(linha)
    if (!m) continue
    let resto = m[2] ?? ''
    const quem = QUEM.exec(resto)
    if (quem) resto = resto.slice(0, quem.index)
    const pr = PR.exec(resto)
    if (pr) resto = resto.replace(PR, '')
    const item: Item = {
      texto: resto.replace(/\s{2,}/g, ' ').trim(),
      estado: MARCA[m[1] ?? ' '] ?? 'falta',
      pr: pr ? Number(pr[1]) : null,
      quem: quem ? (quem[1] ?? '').trim() : null,
    }
    if (lotes.length === 0) lotes.push({ nome: 'Itens', itens: [] })
    lotes[lotes.length - 1]?.itens.push(item)
  }
  return { pasta, titulo, lotes, mtimeMs }
}

/** O estado que vale: PR mergeado vence o arquivo; [x] com PR que não mergeou diverge. */
export function estadoReal(item: Item, prs: Readonly<Record<string, string>>): Estado | 'diverge' {
  const s = item.pr === null ? undefined : prs[String(item.pr)]
  if (s === 'MERGED') return 'feito'
  if (item.estado === 'feito' && s !== undefined) return 'diverge'
  return item.estado
}

/** Quem conta como você no `quem:`: você, eu, me, e o `nome` das opções do mod, se tiver. */
export function quemVoce(nome = ''): RegExp {
  const n = nome.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:eu|me|you${n ? `|${n}` : ''})(?![\\p{L}\\p{N}])|voc[eê]`, 'iu')
}
const VOCE = quemVoce()

/** "esperando você": o item parado em quem lê a faixa. */
export const esperaVoce = (item: Item, voce: RegExp = VOCE): boolean => item.estado === 'esperando' && item.quem !== null && voce.test(item.quem)

export type Placar = {
  lotes: Array<{ nome: string; feitos: number; total: number }>
  feitos: number
  total: number
  esperandoVoce: number
  /** esperando quem não é você, por quem (o texto do `quem:` até a 1ª vírgula ou parêntese) */
  esperandoOutros: Record<string, number>
  diverge: number
  proximo: Item | null
  /** tem item em andamento: é o sprint que está sendo tocado */
  ativo: boolean
  completo: boolean
}

export function placar(s: Sprint, prs: Readonly<Record<string, string>>, voce: RegExp = VOCE): Placar {
  let feitos = 0, total = 0, esperandoVoce = 0, diverge = 0
  const esperandoOutros: Record<string, number> = {}
  let andando: Item | null = null, falta: Item | null = null
  const lotes = s.lotes.map((l) => {
    let f = 0
    for (const it of l.itens) {
      const e = estadoReal(it, prs)
      if (e === 'feito') f++
      if (e === 'diverge') diverge++
      if (esperaVoce(it, voce) && e !== 'feito') esperandoVoce++
      else if (e === 'esperando') {
        const quem = (it.quem ?? 'alguém').split(/[,(]/)[0]?.trim() || 'alguém'
        esperandoOutros[quem] = (esperandoOutros[quem] ?? 0) + 1
      }
      if (e === 'andando' && andando === null) andando = it
      if (e === 'falta' && falta === null) falta = it
    }
    feitos += f
    total += l.itens.length
    return { nome: l.nome.split(/\s+/)[0] ?? l.nome, feitos: f, total: l.itens.length }
  })
  return {
    lotes, feitos, total, esperandoVoce, esperandoOutros, diverge,
    proximo: andando ?? falta, ativo: andando !== null, completo: total > 0 && feitos === total,
  }
}

/** Barra de `largura` células: cheio = feito, vazio = falta. */
export function barra(feitos: number, total: number, largura: number): { cheio: string; vazio: string } {
  const n = total === 0 ? 0 : Math.round((feitos / total) * largura)
  return { cheio: '█'.repeat(n), vazio: '░'.repeat(largura - n) }
}

export type LinhaDaFaixa = {
  nome: string
  ativo: boolean
  /** o lote em curso: o primeiro que não está completo */
  lote: { nome: string; feitos: number; total: number } | null
  feitos: number
  total: number
  esperandoVoce: number
  /** o `quem` que mais segura itens, com a contagem */
  esperandoOutro: { quem: string; n: number } | null
  diverge: number
  proximo: string | null
}

const MAX_LINHAS = 3

/**
 * Uma linha por sprint vivo (completo some): o ativo primeiro, depois o mexido por último. Mais de
 * MAX_LINHAS vira `resto` (o "+N" da última linha).
 */
export function linhasDaFaixa(sprints: readonly Sprint[], prs: Readonly<Record<string, string>>, voce: RegExp = VOCE): { linhas: LinhaDaFaixa[]; resto: number } {
  const vivos = sprints
    .map((s) => ({ s, p: placar(s, prs, voce) }))
    .filter((x) => !x.p.completo && x.p.total > 0)
    .sort((a, b) => Number(b.p.ativo) - Number(a.p.ativo) || b.s.mtimeMs - a.s.mtimeMs)
  const mostrados = vivos.length > MAX_LINHAS ? vivos.slice(0, MAX_LINHAS - 1) : vivos
  const linhas = mostrados.map(({ s, p }) => {
    const outros = Object.entries(p.esperandoOutros).sort((a, b) => b[1] - a[1])[0]
    const prox = p.proximo?.texto ?? null
    return {
      nome: s.pasta.replace(/-\d{4}-\d{2}-\d{2}$/, ''),
      ativo: p.ativo,
      lote: p.lotes.find((l) => l.feitos < l.total) ?? null,
      feitos: p.feitos,
      total: p.total,
      esperandoVoce: p.esperandoVoce,
      esperandoOutro: outros ? { quem: outros[0], n: outros[1] } : null,
      diverge: p.diverge,
      proximo: prox === null ? null : prox.length > 48 ? prox.slice(0, 47) + '…' : prox,
    }
  })
  return { linhas, resto: vivos.length - mostrados.length }
}

