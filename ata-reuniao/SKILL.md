---
name: ata-reuniao
description: Use quando o usuário colar notas soltas de uma reunião e pedir pra organizar, resumir ou montar a ata. Sinais: anotações bagunçadas, tópicos jogados, bullets sem ordem, transcrição de call, "resume essa reunião", "monta a ata", "organiza essas notas".
---

# Ata de Reunião

## Quando usar
Quando chegam notas cruas de uma reunião (tópicos soltos, bullets bagunçados, transcrição) e o pedido é organizar, resumir ou montar a ata.

## O que entregar
Um arquivo HTML único e self-contained (todo o CSS dentro do arquivo, sem dependências externas), pronto pra abrir no navegador e salvar como PDF (Ctrl+P, depois Salvar como PDF). Gere o arquivo direto, sem pedir confirmação. Salve como `ata-<assunto>-<AAAA-MM-DD>.html` e diga onde salvou.

## Estrutura da ata (nesta ordem)
1. **Cabeçalho:** título da reunião, data, lista de participantes.
2. **Objetivo:** uma frase sobre por que a reunião aconteceu.
3. **Decisões:** bullets, só o que foi de fato decidido.
4. **Próximos passos:** tabela com as colunas Ação, Responsável e Prazo.
5. **Pendências e riscos:** bullets do que ficou em aberto.

## Regras de conteúdo
- Use só o que está nas notas. Não invente decisão, responsável ou prazo.
- Se um responsável ou prazo não aparece nas notas, escreva "a definir".
- Se faltar data ou participantes, deixe "[preencher]" visível em vez de adivinhar.
- Português direto, sem floreio. Cada decisão e cada ação em uma linha.
- Sem travessão no texto. Use ponto final.

## Identidade visual
Não use cores nem fontes fixas. Leia a identidade da marca em `brand.md` (na pasta desta skill) e aplique os tokens de lá (paleta, gradiente, tipografia, accent) ao documento.

> Edite o `brand.md` com as cores e fontes da sua marca. Se preferir, aponte pro design system que você já tem. Sem isso, gere um documento limpo e neutro (fundo branco, uma cor de destaque, tipografia legível).

Como aplicar ao documento:
- **Cabeçalho:** faixa com a cor ou o gradiente da marca, o nome ou logo da marca, e o título da reunião.
- **Corpo:** fundo claro pra leitura e impressão. Texto na cor de texto da marca, tipografia de corpo da marca. Títulos de seção na tipografia de título da marca.
- **Tabela de próximos passos:** cabeçalho na cor primária da marca, linhas zebradas leves.
- **Accent:** a cor de accent da marca nos rótulos das seções.
- **Impressão:** inclua um bloco `@media print` (mantém as cores, remove sombras), formato A4.

## Exemplo de uso
O usuário cola um bloco de notas bagunçadas e diz "organiza essas notas da reunião". Você gera o `ata-<assunto>-<data>.html` seguindo a estrutura e a identidade acima, e diz onde salvou. Veja `exemplo-notas.md` pra um input de teste.
