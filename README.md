# JP Labs Skills

Skills prontas pro Claude Code, da série "Claude Code do Zero" no canal JP Labs.
Cada vídeo adiciona uma skill aqui. Pega, usa, adapta pra sua marca.

## Skills

- **ata-reuniao** — transforma notas bagunçadas de reunião numa ata profissional em HTML, pronta pra salvar como PDF. (Parte 2: Skills)

## Como instalar uma skill

Duas formas.

**1. Pedindo pro Claude (mais fácil)**
Baixe a pasta da skill, jogue na raiz do seu projeto e diga:

> "Tem uma skill nessa pasta. Inclui ela no projeto."

O Claude move pra `.claude/skills/` sozinho.

**2. Na mão**
Copie a pasta da skill (ex: `ata-reuniao/`) pra `.claude/skills/` do seu projeto, ou pra `~/.claude/skills/` se quiser ela disponível em qualquer projeto.

Depois, no Claude Code, é só usar (`/ata-reuniao`) ou deixar ele disparar sozinho quando o que você pedir bater com a `description` da skill.

## Adaptar pra sua marca

A `ata-reuniao` lê a identidade visual de `ata-reuniao/brand.md`. Edite esse arquivo com as cores e fontes da sua empresa. Se preferir, aponte a skill pro design system que você já tem. Sem nada disso, ela gera um documento limpo e neutro.

---

Feito por JP Labs. Aprenda a criar as suas no canal.
