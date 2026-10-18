---
name: progresso-md
description: "Cria e mantém o progresso.md de um plano (PRD, spec, roadmap, lista de tarefas grande), o arquivo que o mod progresso mostra na faixa acima do prompt e no painel /progresso. Use sempre que montar um plano com mais de uma etapa, quando o usuário pedir pra acompanhar o progresso de um plano, ou quando o estado de um item do plano mudar."
---

# progresso.md

O mod `progresso` lê arquivos `progresso.md` e mostra, acima do prompt, quanto do plano já foi
feito e qual é a próxima etapa. Esta skill é o lado de quem escreve: você cria o arquivo junto
com o plano e mantém ele verdadeiro.

## Onde fica

- Um plano só no projeto: `progresso.md` na raiz.
- Vários planos: um por pasta, `plans/<nome-do-plano>/progresso.md`, ao lado do plano.
  O nome da pasta é o nome que aparece na faixa.

Se o projeto já tem uma pasta de planos combinada com o usuário, pergunte antes de criar outra.

## Formato

```markdown
# Progresso: <título do plano>

## L0 <primeira fase>
- [x] Plano escrito e aprovado
- [~] <entrega em andamento>
- [!] <coisa que depende de alguém>  quem: você
- [ ] <próxima entrega>

## L1 <segunda fase>
- [ ] <entrega>  pr:12
```

- `##` = uma fase ou lote do plano, na ordem de execução. A primeira palavra do título vira o
  rótulo curto na faixa (`L0`, `Fase1`).
- Um item por entrega concreta, no idioma do projeto.
- Marcas: `[ ]` falta, `[~]` andando, `[!]` esperando alguém, `[x]` feito.
- `quem: <...>` no fim de um item `[!]`: de quem ele espera. `quem: você` (ou `eu`, ou o nome
  que o usuário configurou no mod) aparece em âmbar como "esperando você".
- `pr:N` num item: o mod confere o PR no GitHub (precisa do `gh` logado). PR mergeado conta
  como feito; `[x]` com PR que não mergeou aparece como divergência.

## Regras de manutenção

- **Crie o arquivo junto com o plano**, nunca depois. O que já foi feito pra chegar no plano
  (conversa de alinhamento, o próprio plano) entra como `[x]`.
- **Mude a marca no mesmo passo em que o estado muda**, nunca em lote no fim da sessão.
  Começou um item: `[~]`. Travou esperando alguém: `[!]` com `quem:`. Terminou: `[x]`.
- **Só marque `[x]` com prova feita nesta sessão** (teste rodado, PR mergeado, arquivo
  entregue) e deixe a evidência na linha: `pr:N`, hash do commit ou data.
- Item novo que surgir no caminho entra no lote certo, não no fim do arquivo.
- Item que caiu de escopo sai do arquivo, e você avisa o usuário no mesmo passo. Não deixe
  ele marcado como `[ ]`: a barra contaria como falta pra sempre.
