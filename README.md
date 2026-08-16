# JP Labs Skills

Skills prontas pro Claude Code, da série "Claude Code do Zero" no canal JP Labs.
Cada vídeo adiciona uma skill aqui. Pega, usa, adapta pra sua marca.

## Skills

- **analisar-video** — dá olhos pro Claude. Baixa um vídeo, corta em imagens exatamente onde a imagem muda, transcreve o áudio na sua máquina e decompõe o que foi dito e como foi feito. Serve pra Reel, Short, TikTok, YouTube ou arquivo do seu disco. Roda local, sem API paga e sem conta em lugar nenhum.
- **ata-reuniao** — transforma notas bagunçadas de reunião numa ata profissional em HTML, pronta pra salvar como PDF. (Parte 2: Skills)

## Como instalar uma skill

Duas formas.

**1. Pedindo pro Claude (mais fácil)**
Baixe a pasta da skill, jogue na raiz do seu projeto e diga:

> "Tem uma skill nessa pasta. Inclui ela no projeto."

O Claude move pra `.claude/skills/` sozinho.

**2. Na mão**
Copie a pasta da skill (ex: `analisar-video/`) pra `.claude/skills/` do seu projeto, ou pra `~/.claude/skills/` se quiser ela disponível em qualquer projeto.

Depois, no Claude Code, é só usar (`/analisar-video`) ou deixar ele disparar sozinho quando o que você pedir bater com a `description` da skill.

## Adaptar pra sua marca

As skills que geram documento leem a identidade visual de um `brand.md` na pasta delas. Edite esse arquivo com as cores e fontes da sua empresa. Se preferir, aponte a skill pro design system que você já tem. Sem nada disso, ela gera um documento limpo e neutro.

## Licença

MIT. Use, adapte e distribua à vontade, inclusive comercialmente. Só mantenha o aviso de copyright.

---

## Quer as próximas?

Cada vídeo da série adiciona uma skill nova aqui.

- YouTube: [@thejplabs](https://youtube.com/@thejplabs)
- Instagram: [@thejplabs](https://instagram.com/thejplabs)

Feito por JP Labs.
