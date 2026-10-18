import { expect, test } from 'claude-code/testing'

import { ANEL, COR, anelCells, barraCells, base64, feixe } from './raster'

// decodifica o base64 de volta em células [codePoint, frente, fundo]
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function celulas(s: string): number[][] {
  const bytes: number[] = []
  const limpo = s.replace(/=+$/, '')
  for (let i = 0; i < limpo.length; i += 4) {
    const n = [0, 1, 2, 3].reduce((acc, k) => (acc << 6) | (k < limpo.length - i ? B64.indexOf(limpo[i + k]!) : 0), 0)
    bytes.push((n >> 16) & 255, (n >> 8) & 255, n & 255)
  }
  const u = new Uint32Array(Uint8Array.from(bytes.slice(0, Math.floor(bytes.length / 4) * 4)).buffer)
  const out: number[][] = []
  for (let i = 0; i + 2 < u.length; i += 3) out.push([u[i]!, u[i + 1]!, u[i + 2]!])
  return out
}

test('base64 bate com o padrao (padding incluso)', () => {
  expect(base64(new Uint8Array([77, 97, 110]))).toBe('TWFu')
  expect(base64(new Uint8Array([77, 97]))).toBe('TWE=')
  expect(base64(new Uint8Array([77]))).toBe('TQ==')
})

test('feixe: escuro no inicio, acento no meio, claro no fim', () => {
  expect(feixe(0)).toBe(COR.feixe[0])
  expect(feixe(0.5)).toBe(COR.feixe[1])
  expect(feixe(1)).toBe(COR.feixe[2])
})

test('barra: largura exata, feito em bloco com degrade, resto em trilho', () => {
  const c = celulas(barraCells(7, 10, 10))
  expect(c.length).toBe(10)
  expect(c.slice(0, 7).every((x) => x[0] === 0x2588)).toBe(true)
  expect(c.slice(7).every((x) => x[0] === 0x2591 && x[1] === COR.trilho)).toBe(true)
  expect(c[0]![1]).toBe(COR.feixe[0])
  expect(c[6]![1]).toBe(COR.feixe[2])
})

test('barra com brilho clareia a coluna do feixe', () => {
  const parada = celulas(barraCells(10, 10, 10))
  const comBrilho = celulas(barraCells(10, 10, 10, 4))
  expect(comBrilho[4]![1]).not.toBe(parada[4]![1])
  expect(comBrilho[9]![1]).toBe(parada[9]![1])
})

test('anel: tamanho do Raster, % no miolo, so caracteres de largura 1', () => {
  const c = celulas(anelCells(27))
  expect(c.length).toBe(ANEL.colunas * ANEL.linhas)
  const meio = c.slice(Math.floor(ANEL.linhas / 2) * ANEL.colunas, (Math.floor(ANEL.linhas / 2) + 1) * ANEL.colunas)
  expect(meio.map((x) => String.fromCharCode(x[0]!)).join('')).toContain('27%')
  expect(c.every((x) => [0x20, 0x2580].includes(x[0]!) || (x[0]! >= 0x25 && x[0]! <= 0x39))).toBe(true)
})

test('anel: 0% nao tem arco feito, 100% nao tem trilho', () => {
  const corDoArco = (cs: number[][]) => cs.flatMap((x) => (x[0] === 0x2580 ? [x[1]!, x[2]!] : [])).filter((cor) => cor !== COR.card)
  expect(corDoArco(celulas(anelCells(0))).every((cor) => cor === COR.trilho)).toBe(true)
  expect(corDoArco(celulas(anelCells(100))).some((cor) => cor === COR.trilho)).toBe(false)
})
