// raster.ts — as células dos Rasters do painel (marca JP Labs v4.1). Puro: entra número, sai base64.
//
// Uma célula é [codePoint, frente, fundo] em u32 little-endian. O anel usa meio-bloco ('▀': frente =
// pixel de cima, fundo = pixel de baixo), o que dá pixel quase quadrado no terminal.

export const COR = {
  fundo: 0x01010d,
  card: 0x0e0e1a,
  trilho: 0x23233a,
  ink: 0xededef,
  muted: 0x838389,
  feixe: [0x3b2a8f, 0x9a73ff, 0xc9b6ff] as const,
  brilho: 0xf4efff,
}

const BLOCO = 0x2588 // █
const MEIO = 0x2580 // ▀
const VAZIO = 0x2591 // ░
const ESPACO = 0x20

const mistura = (a: number, b: number, t: number): number => {
  const c = (s: number) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t))
  return (c(16) << 16) | (c(8) << 8) | c(0)
}

/** O degradê do feixe em t de 0 a 1: escuro -> acento -> claro. */
export function feixe(t: number): number {
  const [a, b, c] = COR.feixe
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? mistura(a, b, x * 2) : mistura(b, c, (x - 0.5) * 2)
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** base64 padrão com padding, sem depender de btoa nem de toBase64 no ambiente. */
export function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0, b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < bytes.length ? B64[(n >> 6) & 63]! : '=') + (i + 2 < bytes.length ? B64[n & 63]! : '=')
  }
  return out
}

const empacota = (celulas: number[]): string => base64(new Uint8Array(Uint32Array.from(celulas).buffer))

/**
 * Barra de 1 linha: o feito em degradê do feixe, o resto em trilho. `brilho` é a coluna onde o
 * feixe passa (null = parada): ela e as vizinhas clareiam.
 */
export function barraCells(feitos: number, total: number, largura: number, brilho: number | null = null): string {
  const n = total === 0 ? 0 : Math.round((feitos / total) * largura)
  const cel: number[] = []
  for (let x = 0; x < largura; x++) {
    if (x < n) {
      let cor = feixe(n <= 1 ? 1 : x / (n - 1))
      if (brilho !== null) {
        const d = Math.abs(x - brilho)
        if (d < 3) cor = mistura(cor, COR.brilho, d === 0 ? 0.85 : d === 1 ? 0.45 : 0.15)
      }
      cel.push(BLOCO, cor, COR.card)
    } else {
      cel.push(VAZIO, COR.trilho, COR.card)
    }
  }
  return empacota(cel)
}

export const ANEL = { colunas: 14, linhas: 7 }

/**
 * Anel de progresso 14x7 células (14x14 pixels): o arco feito no degradê do feixe, de 12h no
 * sentido horário, o resto em trilho, e o % escrito no miolo.
 */
export function anelCells(pct: number): string {
  const { colunas: W, linhas: H } = ANEL
  const cx = (W - 1) / 2, cy = (H * 2 - 1) / 2
  const R = 6.9, r = 4.4
  const frac = Math.min(1, Math.max(0, pct / 100))
  const pixel = (x: number, y: number): number => {
    const dx = x - cx, dy = y - cy
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d > R || d < r) return COR.card
    const ang = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2) // 0 = 12h, horário
    return ang <= frac && frac > 0 ? feixe(ang / Math.max(frac, 0.0001)) : COR.trilho
  }
  const rotulo = `${Math.round(frac * 100)}%`
  const ini = Math.round(cx - (rotulo.length - 1) / 2)
  const meio = Math.floor(H / 2)
  const cel: number[] = []
  for (let row = 0; row < H; row++) {
    for (let x = 0; x < W; x++) {
      const k = x - ini
      if (row === meio && k >= 0 && k < rotulo.length) {
        cel.push(rotulo.charCodeAt(k), COR.ink, COR.card)
        continue
      }
      const cima = pixel(x, row * 2), baixo = pixel(x, row * 2 + 1)
      if (cima === COR.card && baixo === COR.card) cel.push(ESPACO, COR.card, COR.card)
      else cel.push(MEIO, cima, baixo)
    }
  }
  return empacota(cel)
}
