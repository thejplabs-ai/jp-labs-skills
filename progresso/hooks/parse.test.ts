import { expect, test } from 'claude-code/testing'

import { barra, estadoReal, linhasDaFaixa, parseProgresso, placar, quemVoce } from './parse'

const MD = [
  '# Progresso: Loja nova',
  '## L0 Base',
  '- [x] página de produto  pr:250',
  '- [ ] carrinho  pr:252',
  '- [!] fotos dos produtos  quem: seg 19/10 9h05',
  '- [!] aprovar o layout  quem: você',
  '- [~] checkout',
  '- [ ] e-mail de confirmação',
  '## L1 Lançamento',
  '- [ ] domínio',
  '- [x] marcado mas nao mergeou  pr:999',
].join('\n')

test('le titulo, lotes, marcas, pr e quem', () => {
  const s = parseProgresso('loja-nova-2026-10-16', MD, 1)
  expect(s.titulo).toBe('Loja nova')
  expect(s.lotes.map((l) => l.nome)).toEqual(['L0 Base', 'L1 Lançamento'])
  const [a, b, c] = s.lotes[0]?.itens ?? []
  expect(a).toEqual({ texto: 'página de produto', estado: 'feito', pr: 250, quem: null })
  expect(b?.pr).toBe(252)
  expect(c).toEqual({ texto: 'fotos dos produtos', estado: 'esperando', pr: null, quem: 'seg 19/10 9h05' })
})

test('PR mergeado vence o arquivo, [x] sem merge diverge', () => {
  const s = parseProgresso('x', MD, 1)
  const prs = { '250': 'MERGED', '252': 'MERGED', '999': 'OPEN' }
  expect(estadoReal(s.lotes[0]!.itens[1]!, prs)).toBe('feito')
  expect(estadoReal(s.lotes[1]!.itens[1]!, prs)).toBe('diverge')
  const p = placar(s, prs)
  expect(p.lotes).toEqual([{ nome: 'L0', feitos: 2, total: 6 }, { nome: 'L1', feitos: 0, total: 2 }])
  expect(p.esperandoVoce).toBe(1)
  expect(p.diverge).toBe(1)
})

test('quem é você: você, eu, me e o nome configurado, palavra inteira, com acento', () => {
  const padrao = quemVoce()
  for (const q of ['você', 'voce', 'Eu', 'me (até sexta)', 'you']) expect(padrao.test(q)).toBe(true)
  for (const q of ['Ana', 'time de design', 'meu sócio', 'JP']) expect(padrao.test(q)).toBe(false)
  const ana = quemVoce('Ana')
  expect(ana.test('Ana, sexta')).toBe(true)
  expect(ana.test('Mariana')).toBe(false)
  expect(quemVoce('João').test('joão')).toBe(true)
  expect(quemVoce('a.b').test('axb')).toBe(false) // o nome entra literal, não como regex
  const s = parseProgresso('x', '## A\n- [!] revisar  quem: Ana', 1)
  expect(placar(s, {}).esperandoVoce).toBe(0)
  expect(placar(s, {}, ana).esperandoVoce).toBe(1)
  expect(placar(s, {}).esperandoOutros).toEqual({ Ana: 1 })
})

test('proximo: o primeiro em andamento; sem andamento, o primeiro que falta', () => {
  expect(placar(parseProgresso('x', MD, 1), {}).proximo?.texto).toBe('checkout')
  const sem = MD.replace('- [~] checkout', '- [ ] checkout')
  expect(placar(parseProgresso('x', sem, 1), {}).proximo?.texto).toBe('carrinho')
})

test('faixa: uma linha por vivo, o ativo primeiro mesmo sendo o mais velho, completo some', () => {
  const ativo = parseProgresso('loja-nova-2026-10-16', MD, 10) // tem [~]
  const novo = parseProgresso('site-institucional-2026-10-15', '## A\n- [ ] x\n- [!] y  quem: Ana', 20)
  const pronto = parseProgresso('feito-2026-09-01', '## A\n- [x] y', 30)
  const { linhas, resto } = linhasDaFaixa([novo, ativo, pronto], { '250': 'MERGED' })
  expect(resto).toBe(0)
  expect(linhas.map((l) => l.nome)).toEqual(['loja-nova', 'site-institucional'])
  expect(linhas[0]).toMatchObject({ ativo: true, lote: { nome: 'L0', feitos: 1, total: 6 }, feitos: 2, total: 8, esperandoVoce: 1, proximo: 'checkout' })
  expect(linhas[1]).toMatchObject({ ativo: false, esperandoOutro: { quem: 'Ana', n: 1 }, proximo: 'x' })
  expect(linhasDaFaixa([pronto], {}).linhas).toEqual([])
})

test('faixa: mais de 3 vivos mostra 2 e conta o resto', () => {
  const v = (n: string, t: number) => parseProgresso(n, '## A\n- [ ] x', t)
  const { linhas, resto } = linhasDaFaixa([v('a', 1), v('b', 2), v('c', 3), v('d', 4)], {})
  expect(linhas.map((l) => l.nome)).toEqual(['d', 'c'])
  expect(resto).toBe(2)
})

test('barra: proporcional, sempre na largura pedida', () => {
  expect(barra(7, 10, 10)).toEqual({ cheio: '███████', vazio: '░░░' })
  expect(barra(0, 0, 4)).toEqual({ cheio: '', vazio: '░░░░' })
  expect(barra(3, 3, 5).cheio.length + barra(3, 3, 5).vazio.length).toBe(5)
})
