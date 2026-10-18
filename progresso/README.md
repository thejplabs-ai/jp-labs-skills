# progresso

Um mod pro Claude Code que mostra, acima do prompt, quanto do teu plano já foi feito e qual é a
próxima etapa. Chega de perguntar pro Claude "o que falta?".

- **Faixa acima do prompt:** uma linha por plano vivo, com a barra do lote em curso, o total e o
  próximo item.
- **Painel `/progresso`:** um cartão por plano, com o anel de %, a barra de cada lote e cada item
  com o estado dele.
- **O Claude marca sozinho:** começou um item, vira andando; terminou, vira feito, e a barra anda.
- **Esperando você:** item parado em você aparece em âmbar, pra não travar o plano.
- **Confere com o GitHub:** item com `pr:N` é conferido pelo `gh`. Marcado como feito com PR que
  não entrou aparece como divergência.

## Instalar

Precisa do Claude Code 2.1.287 ou mais novo (`claude --version`). Dentro do Claude Code, no terminal:

```
/plugin install progresso --marketplace thejplabs-ai/jp-labs-skills
```

Responde `y` pra adicionar o marketplace e escolhe o escopo (o de usuário vale pra todo projeto).

Fora do Claude Code, no terminal:

```
claude plugin install progresso --marketplace thejplabs-ai/jp-labs-skills
```

No app de desktop, onde o `/plugin` não roda: clica no + ao lado da caixa do prompt, depois
Plugins, Add marketplace com `thejplabs-ai/jp-labs-skills`, e Add plugin.

## Usar

Pede um plano pro Claude como você já pede ("monta o plano pra lançar a loja"). A skill que vem
junto faz ele criar o `progresso.md` ao lado do plano, e a faixa aparece. Daí pra frente ele mantém
o arquivo verdadeiro enquanto trabalha. `/progresso` abre o painel.

O mod procura `progresso.md` na raiz do projeto, em `plans/<plano>/` e em
`.aios/plans/sprints/<plano>/`. O formato:

```markdown
# Progresso: Loja nova

## L0 Base
- [x] Plano aprovado
- [~] Página de produto
- [!] Fotos dos produtos  quem: você
- [ ] Carrinho  pr:12
```

`[ ]` falta · `[~]` andando · `[!]` esperando alguém (`quem:` no fim) · `[x]` feito.

**Teu nome no `quem:`** (opcional): por padrão `quem: você`, `eu` ou `me` contam como esperando
você. Se você escreve o teu nome, coloca ele em `/config`, na linha do `progresso`.

## O que ele acessa

Mod roda com o teu acesso, igual a você. Só instala mod de quem você confia. Este aqui:

- **lê** só arquivos `progresso.md` nas pastas acima, e nada mais do teu disco;
- **roda** um comando só, `gh pr list` (leitura), e só em projeto que tem `pr:N` em algum item.
  Sem `gh` ou sem GitHub, ele para de conferir e o resto funciona;
- **escreve no contexto do Claude** uma regra de 3 linhas pedindo pra manter o `progresso.md`
  verdadeiro, e só em projeto que tem um. Em conta de empresa que gerencia o Claude Code, essa
  regra pode não entrar; a skill que vem junto cobre o mesmo pedido;
- **não** acessa a internet, **não** guarda nada fora da sessão e **não** manda dado pra ninguém.

O código é curto e está todo aqui (`hooks/`). Lê antes de instalar, se quiser.

Testado no Windows. Usa só a API do Claude Code pra arquivo e processo, sem caminho de sistema,
então deve funcionar no Mac e no Linux. Se testar, conta.

## Licença

MIT. Feito por [JP Labs](https://instagram.com/thejplabs).
