import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const RAIZ = 'C:\\Users\\ana\\loja'
const P = RAIZ.replace(/\\/g, '/')

/** Um projeto em memória: caminho do arquivo -> texto. */
function projeto(on: On, arquivos: Readonly<Record<string, string>>, recusaComando = false): void {
  const n = (c: string): string => c.replace(/\\/g, '/')
  const abs: Record<string, string> = Object.fromEntries(Object.entries(arquivos).map(([k, v]) => [`${P}/${k}`, v]))
  on('session.root', () => ({ value: RAIZ }))
  on('command.register', () => (recusaComando ? { deny: 'it is the plugin skill /progresso:progresso' } : { value: { command: 'progresso' } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('fs.stat', (_$, e) => {
    const t = abs[n(e.path)]
    if (t === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: { kind: 'file' as const, size: t.length, mtimeMs: 1, isLink: false } }
  })
  on('fs.read', (_$, e) => {
    const t = abs[n(e.path)]
    if (t === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: t }
  })
  on('fs.list', (_$, e) => {
    const pre = `${n(e.path)}/`
    const nomes = new Set(Object.keys(abs).filter((k) => k.startsWith(pre)).map((k) => k.slice(pre.length).split('/')[0]!))
    if (nomes.size === 0) throw new Error(`ENOENT ${e.path}`)
    return { value: [...nomes].map((name) => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 1, isLink: false })) }
  })
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'gh: not found', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  mock.clock(on)
}

const RUN = { command: 'progresso', args: '', origin: { kind: 'sdk' as const }, presentation: { isFullscreen: false, columns: 120 } }
const COMPOSE = { model: 'm', promptModel: 'm', surfaces: ['terminal'] as const, tools: [], outputStyle: null, traits: [] }

async function abrir($: Engine): Promise<void> {
  await $.session.start({ cwd: P, surface: 'terminal', isInteractive: true })
}

for (const onde of ['progresso.md', 'plans/checkout/progresso.md', '.aios/plans/sprints/s1/progresso.md']) {
  test(`acha só ${onde}`, async ($, on) => {
    projeto(on, { [onde]: '## A\n- [ ] um' })
    on('prompt.compose', () => ({ sections: [] }))
    await abrir($)
    expect((await $.command.run(RUN)).text).toBe('Painel de progresso aberto.')
  })
}

test('os três juntos, com a regra no prompt', async ($, on) => {
  projeto(on, {
    'progresso.md': '# Progresso: Raiz\n## A\n- [ ] um',
    'plans/checkout/progresso.md': '# Progresso: Checkout\n## A\n- [x] um\n- [ ] dois',
    '.aios/plans/sprints/s1/progresso.md': '# Progresso: Sprint\n## A\n- [~] um',
  })
  on('prompt.compose', () => ({ sections: [] }))
  await abrir($)
  expect((await $.command.run(RUN)).text).toBe('Painel de progresso aberto.')
  const r = await $.prompt.compose(COMPOSE)
  const regra = r.sections.find((s) => s.id === 'progresso:regra')
  expect(regra?.text).toContain('quem: <você |')
})

test('sem progresso.md: sem regra no prompt, e o /progresso ensina a criar', async ($, on) => {
  projeto(on, { 'README.md': 'oi' })
  on('prompt.compose', () => ({ sections: [] }))
  await abrir($)
  expect((await $.command.run(RUN)).text).toContain('Peça pro Claude montar o plano')
  expect((await $.prompt.compose(COMPOSE)).sections).toEqual([])
})

test('a opção nome entra na regra', { options: { nome: 'Ana' } }, async ($, on) => {
  projeto(on, { 'progresso.md': '## A\n- [!] revisar  quem: Ana' })
  on('prompt.compose', () => ({ sections: [] }))
  await abrir($)
  const r = await $.prompt.compose(COMPOSE)
  expect(r.sections.find((s) => s.id === 'progresso:regra')?.text).toContain('quem: <Ana |')
})

test('nome /progresso tomado: o mod segue lendo o plano e pondo a regra', async ($, on) => {
  projeto(on, { 'progresso.md': '## A\n- [ ] um' }, true)
  on('prompt.compose', () => ({ sections: [] }))
  await abrir($)
  const r = await $.prompt.compose(COMPOSE)
  expect(r.sections.find((s) => s.id === 'progresso:regra')).toBeDefined()
})
