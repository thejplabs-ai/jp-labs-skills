---
name: radar
description: "Use quando a pessoa quiser saber o que vale virar conteúdo olhando os criadores que ela acompanha: 'roda o radar', 'o que estourou essa semana', 'acha reel pra eu modelar', 'o que meus concorrentes postaram de bom'. Busca os reels recentes de uma lista de perfis do Instagram, acha o que fugiu da média do PRÓPRIO criador (não o de mais views), assiste os melhores e entrega uma shortlist com o porquê de cada um."
---

# Radar

## O problema

Escolher referência no olho não funciona. O post de 2 milhões de views de um perfil gigante
pode ser só a rotina dele, e não te ensina nada. O que ensina é o vídeo em que o criador
**surpreendeu ele mesmo**: ali tem uma decisão nova, um gancho, um formato, um assunto.

O Radar mede isso. Para cada perfil da lista, ele pega os reels recentes, calcula a mediana de
views daquele perfil e divide cada reel por ela. Um reel de 40 mil num perfil que faz 11 mil
de rotina é 3,6x. Ele vem antes de um de 2 milhões num perfil que faz 2 milhões.

## Antes de rodar: confira e instale

Confira tudo isto em silêncio. **O que faltar, instale você mesmo**, dizendo à pessoa em uma
linha o que está instalando e pra quê. Não mande ela se virar.

| O quê | Pra quê | Como conferir | Como instalar |
|---|---|---|---|
| Python 3.8+ | roda o radar | `python3 --version` (no Windows, `python --version`) | `winget install Python.Python.3.12` · `brew install python` · `sudo apt install python3` |
| Skill `analisar-video` | assiste os reels selecionados | existe `analisar-video/extract.py` ao lado da pasta desta skill | baixe a pasta `analisar-video` de https://github.com/thejplabs-ai/jp-labs-skills e coloque ao lado desta |
| Dependências do `analisar-video` | cortar imagem e transcrever | ver "Antes de rodar" no `SKILL.md` dela | ffmpeg, e os pacotes Python no ambiente `~/.jp-labs-skills/venv` |
| Conta na Apify | busca os reels no Instagram | `python3 radar.py custo` não diz `SEM_TOKEN` | ver abaixo |

**Token da Apify.** É a única conta necessária. O plano grátis dá 5 dólares por mês, e uma
busca de 10 perfis custa uns 40 centavos de dólar. A pessoa cria a conta em
https://apify.com, copia o token em *Settings → API & Integrations*, e cola num arquivo
`radar-dados/.env` com uma linha só: `APIFY_TOKEN=o_token_dela`.

**Nunca peça o token no chat** e nunca imprima o `.env`. Abra o arquivo vazio pra ela colar.
Se a pasta do projeto for um repositório git, adicione `radar-dados/` ao `.gitignore` antes
de criar o `.env`.

O `radar.py` mora na pasta desta skill. Chame pelo caminho completo
(`.claude/skills/radar/radar.py` ou `~/.claude/skills/radar/radar.py`). Os dados ficam em
`radar-dados/`, na pasta onde a pessoa está trabalhando.

## Primeira vez: a lista de criadores

Se `radar-dados/criadores.md` não existe, pergunte, uma coisa por vez:

1. **Quais perfis do Instagram você quer vigiar?** Concorrentes, gente que você admira, gente
   de outro nicho que faz o formato que você quer. Peça de 5 a 15. Mais que isso sobe o custo
   sem melhorar a lista.
2. **Quer separar em grupos?** (ex: "Concorrentes", "Formato", "Fora do nicho"). Opcional.
3. **Qual é o teu nicho, em uma frase?** Vai pro topo do arquivo e é o que você usa pra cortar
   o que não serve.

Escreva assim:

```markdown
# Nicho: <a frase da pessoa>

## Concorrentes
- @perfil1
- @perfil2

## Formato
- @perfil3
```

A pessoa edita esse arquivo quando quiser. É a única configuração.

## Passo 1: custo, sempre antes

```bash
python3 <pasta-da-skill>/radar.py custo
```

Mostre o `CUSTO_ESTIMADO` e o `SALDO_APIFY` e **espere o ok** antes de gastar. Se disser
`ACIMA DO TETO`, corte perfis. Se disser `SALDO INSUFICIENTE`, o limite reseta no dia 1.

## Passo 2: buscar

```bash
python3 <pasta-da-skill>/radar.py buscar --sim
```

Leva alguns minutos (5 perfis por chamada). Sai em `radar-dados/runs/<data>/candidatos.json`,
com os vídeos baixados em `videos/`. Só entra reel que fez pelo menos 1,5x a média do criador
(`--piso` muda isso) nos últimos 21 dias (`--dias`).

`SEM_REELS: @x` = perfil privado, nome digitado errado ou nada postado na janela. Avise e siga.
Erro da Apify: mostre a mensagem real que ela devolveu, não invente causa.

## Passo 3: cortar o que não é do nicho

Leia a `legenda` de cada candidato e a frase do nicho no topo do `criadores.md`. Marque
`"no_nicho": false` no que claramente não serve. Na dúvida, deixe.

## Passo 4: assistir os melhores

Pros até 8 primeiros que ficaram, com `video_local`, rode o `analisar-video` no arquivo:

```bash
~/.jp-labs-skills/venv/bin/python <pasta-do-analisar-video>/extract.py --file radar-dados/runs/<data>/videos/<id>.mp4 radar-dados/runs/<data>/analise/<id>
```

(No Windows, o Python do ambiente é `%USERPROFILE%\.jp-labs-skills\venv\Scripts\python.exe`.)

Leia o `transcript.txt` e as imagens de `frames/` de cada um. Escreva no `candidatos.json`,
em cada candidato:

- `porque`: o que o vídeo é e por que ele fugiu da média, pelo que foi **dito e mostrado**,
  não pela legenda. 2 a 3 frases.
- `angulo`: como a pessoa faria a versão dela, no nicho dela. 2 a 3 frases.
- `formato`: como foi gravado, curto (`rosto falando`, `tela gravada + voz`, `texto na tela`,
  `tela dividida`, `b-roll`).

Reel sem vídeo (o download falhou): escreva pela legenda e diga no `porque` que não deu pra
assistir.

## Passo 5: a shortlist

```bash
python3 <pasta-da-skill>/radar.py html
```

Abra `radar-dados/runs/<data>/shortlist.html` pra pessoa. O vídeo toca ali mesmo.

## Passo 6: marcar como visto

Depois que a pessoa olhou, marque todos os que apareceram, pra não voltarem na próxima:

```bash
python3 <pasta-da-skill>/radar.py vistos --ids <id1>,<id2>,...
```

## Regras

- Nunca rode `buscar --sim` sem mostrar o custo e ouvir o ok.
- Não escreva o HTML na mão. Escreva no `candidatos.json` e rode `html`.
- Só o que está no material: o que não deu pra ver no vídeo, diga que não deu pra ver.

## O auto-check

`test_radar.py` prova que a leitura dos criadores e a conta do breakout continuam certas se
alguém mexer no código. Ninguém precisa rodar pra usar a skill.
