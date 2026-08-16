---
name: analisar-video
description: "Use quando o pedido for entender ou analisar um vídeo: reel, short, TikTok, YouTube, aula gravada, demo de produto. Sinais: uma URL de vídeo colada no chat, 'analisa esse vídeo', 'por que esse reel funcionou', 'disseca esse short pra mim', 'o que dá pra copiar daqui'. Baixa o vídeo, corta em imagens exatamente onde a imagem muda, transcreve o áudio na máquina e decompõe o que foi dito e como foi feito."
---

# Analisar vídeo

## O problema

O Claude não assiste vídeo. Não existe entrada de vídeo no site, no Claude Code
nem na API. O que ele enxerga é **imagem**, e vídeo é imagem mais som. Quem separa
as duas coisas é você.

Sem isso, pedir análise de um vídeo devolve chute educado em cima da legenda.

## Quando usar

Alguém colou uma URL de vídeo, ou pediu pra entender um vídeo: por que um reel
funcionou, o que copiar de um concorrente, o que foi ensinado numa aula gravada,
o que uma demo de produto mostra na tela.

## Antes de rodar

O script confere as dependências sozinho e diz o que fazer se faltar alguma. Se
ele reclamar, **ofereça instalar pra pessoa** em vez de mandar ela se virar.

| Programa | Pra quê | Instalar |
|---|---|---|
| ffmpeg | corta o vídeo em imagem. Obrigatório | `winget install ffmpeg` · `brew install ffmpeg` · `sudo apt install ffmpeg` |
| curl_cffi | baixar do Instagram | `pip install curl_cffi` |
| yt-dlp | baixar do YouTube, Shorts e TikTok | `pip install yt-dlp` |
| faster-whisper | transcrever o áudio | `pip install faster-whisper` |

Sem o faster-whisper o script ainda roda: entrega as imagens e avisa que ficou sem
transcrição. Na primeira transcrição ele baixa o modelo (alguns minutos, uma vez só).

Nada aqui usa API paga nem pede conta em lugar nenhum. Roda tudo na máquina.

## Passo 1 — extrair

```bash
python extract.py <URL> <PASTA>
python extract.py --file <VIDEO> <PASTA>   # vídeo que já está no disco
```

Opções: `--model` (tamanho do modelo, padrão `medium`), `--scene` (sensibilidade do
corte, padrão `0.30`), `--max-frames` (teto de imagens, padrão `24`),
`--no-transcribe`.

Sai na pasta: `transcript.txt`, `frames/` (uma imagem por corte, mais `hook.jpg`) e
`meta.json` (duração, idioma, quantos cortes, em que segundo cada um, legenda e autor).

**Por que corte e não frame de N em N segundos:** amostragem cega devolve quadro
aleatório. Cortar onde a imagem muda devolve a decisão que o editor tomou. É a
diferença entre um álbum de fotos e a edição.

Se saiu imagem demais e muita coisa repetida, rode de novo com `--scene 0.45`. Se
saiu imagem de menos num vídeo que corta muito, `--scene 0.20`.

## Passo 2 — decompor o que foi DITO

Leia o `transcript.txt` inteiro antes de escrever uma linha.

1. **Hook.** Copie verbatim o que é dito nos primeiros segundos. Nomeie a técnica:
   negação de capacidade ("X não consegue fazer Y"), pergunta de autoidentificação,
   número que choca, contradição, promessa com prazo. Diga o que ele promete e o
   que fica em aberto.
2. **Beats.** Quebre a fala em blocos com **uma função cada**, e nomeie a função,
   não o assunto. Num vídeo de opinião costuma ser limitação, revelação, mecanismo,
   prova, resultado, objeção morta, chamada. Numa aula é outra coisa: problema,
   passo, armadilha, checagem. Não force uma lista pronta em cima do material.
3. **O arco.** Escreva a sequência dos beats numa linha. Depois teste: cada beat só
   faz sentido depois do anterior? Se dá pra embaralhar a ordem sem perder nada,
   aquilo é lista, não argumento. Anote, isso é uma descoberta sobre o vídeo.
4. **Ritmo.** Pelos timestamps, quanto tempo cada beat leva. Onde ele repete, onde
   acelera, onde para.
5. **A chamada final.** O que pede, com que palavra exata, e o que oferece em troca.
6. **A legenda** (`meta.json` → `caption`). Compare com a fala. Muita gente escreve
   na legenda a frase mais afiada e não fala ela. Se for o caso, aponte: é a linha
   que estava desperdiçada.

## Passo 3 — decompor como foi FEITO

Abra as imagens de `frames/` e leia o `meta.json`. Sem esta parte a análise é meia
análise, e é ela que quase ninguém faz.

1. **Ritmo de corte.** `n_frames` dividido por `duration` dá os cortes por segundo.
   Escreva o número. Olhe `cut_times`: os cortes estão espalhados ou empilhados num
   trecho só?
2. **`hook.jpg` primeiro.** Sem som, em um segundo, dá pra saber do que se trata?
3. **Percorra `scene_001` até o fim, na ordem**, cada uma com o segundo dela em
   `cut_times`. Para cada imagem, uma pergunta só: **o que mudou** em relação à
   anterior? Pessoa, cenário, texto na tela, gráfico, ângulo?
4. **Estados de tela.** Classifique o que se repete: rosto cheio, tela dividida,
   captura de tela, b-roll inteiro. Diga em qual beat cada estado aparece. O padrão
   de alternância vale mais que a lista.
5. **Texto na tela.** Transcreva o que estiver escrito em cada imagem. Compare com
   a fala: repete a mesma palavra ou complementa?
6. **Setup.** Enquadramento, altura da câmera, luz, o que aparece no fundo, se tem
   microfone no quadro. É o que diz se dá pra reproduzir com o que a pessoa tem.
7. **Paleta.** As cores que se repetem, e de quem elas são.
8. **A pergunta que fecha:** cada corte entrega informação nova, ou só ritmo?

## Passo 4 — escrever a análise

Salve `analise-<nome>.md` na mesma pasta, nesta ordem:

- **Cabeçalho:** fonte, duração, cortes por segundo, e o engajamento se veio no
  `meta.json`.
- **1. O que foi dito** (passo 2).
- **2. Como foi feito** (passo 3).
- **3. O que vale copiar.** Separe **técnica** de **execução**. Técnica é o que
  transfere ("hook por negação de capacidade"). Execução é o que não transfere,
  porque é a frase e o rosto de outra pessoa. Diga também o que **não** copiar.

Duas regras: só o que está no material, sem inventar intenção que ninguém pode
confirmar. E o que não deu pra ver nas imagens, escreva "não deu pra ver" em vez
de preencher com achismo.

## Relatório apresentável (só se pedirem)

O padrão é markdown, porque ele volta pro Claude depois pra virar teu roteiro. Se
pedirem algo pra mostrar pra cliente ou pro chefe, gere também um HTML único, com
todo o CSS dentro, pronto pra abrir e salvar como PDF. A identidade visual vem do
`brand.md` desta pasta: faixa de cabeçalho na cor primária, corpo claro pra
impressão, accent nos rótulos de seção, e um bloco `@media print` em A4.

## Quando o download falhar

Post privado, post sem vídeo, ou o site mudou o formato. A saída que funciona
sempre, inclusive pra vídeo que nunca esteve na internet:

```bash
python extract.py --file <arquivo> <PASTA>
```

Baixe o vídeo do jeito que conseguir e passe o arquivo. Da extração pra frente é
tudo idêntico.

## O auto-check

`test_extract.py` prova que as partes que leem texto continuam certas se alguém
mexer no código. Ninguém precisa rodar pra usar a skill.
