/** Marca do item no progresso.md: `[ ]` falta, `[~]` andando, `[!]` esperando, `[x]` feito. */
export type Estado = 'falta' | 'andando' | 'esperando' | 'feito'

export type Item = {
  texto: string
  estado: Estado
  /** `pr:N` no item: conferido no GitHub */
  pr: number | null
  /** `quem: ...` no fim do item: de quem o item espera */
  quem: string | null
}

export type Lote = { nome: string; itens: Item[] }

export type Sprint = {
  /** nome da pasta do sprint */
  pasta: string
  titulo: string
  lotes: Lote[]
  mtimeMs: number
}

declare module 'claude-code' {
  interface PluginState {
    progresso: {
      sprints: Sprint[]
      /** número do PR -> MERGED | OPEN | CLOSED, da última leitura do gh */
      prs: Record<string, string>
    }
  }
}
