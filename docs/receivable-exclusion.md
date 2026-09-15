# Exclusão de contas a receber

Excluir abate somente o saldo principal restante da parcela selecionada, preservando seu valor original e os recebimentos. Vale para contas manuais, vinculadas a vendas e parcialmente recebidas. Quitadas, canceladas e já excluídas são bloqueadas. Não há estorno nem restauração por este fluxo.

## API autenticada

1. `GET /receivables/:installmentId/deletion-preview` retorna `installmentId`, `saleId`, `amount`, `paidAmount`, `waivedAmount`, `openAmountBefore`, `openAmountAfter` e `previewToken`. Os saldos antes/depois são do título completo.
2. `DELETE /receivables/:installmentId` recebe `{ "reason": "Justificativa", "previewToken": "token da simulação" }`.

O motivo deve ser texto não vazio. Sucesso retorna `200`, mensagem e valores da simulação aplicada; parcela inexistente retorna `404`. Motivo inválido, parcela inelegível ou simulação desatualizada retornam `400`. Erros seguem `{ "message": "..." }`.

O token representa o estado financeiro do título e suas parcelas. A confirmação confere novamente esse estado sob bloqueio, dentro da transação. Em caso de mudança, a tela consulta novos valores e exige outra confirmação; nunca reenvia automaticamente.

## Persistência e saldos

- `receivable_installments.deletionAuditId`: INTEGER nullable, FK para `audits.idAudit`, `ON DELETE RESTRICT`, com índice. Usuário, data/hora e motivo ficam na auditoria vinculada.
- `receivable_installments.waivedAmount`: DECIMAL(10,2), obrigatório, padrão zero; registra o saldo abatido no momento da exclusão.
- A parcela usa `CANCELLED`; o vínculo de auditoria distingue a nova exclusão de cancelamentos anteriores. Não há JSON ou arrays no schema desta mudança.
- Auditoria, marcação da parcela, saldo do título e quantidade de parcelas ativas da venda são atualizados na mesma transação. Valor dos itens e total original da venda permanecem iguais.
- Listagem do A receber e parcelas no detalhe da venda expõem `deletionAuditId` e `waivedAmount`. O título no detalhe da venda expõe o abatimento agregado em `waivedAmount`.
- Dashboard e resumos mantêm os recebimentos preservados e eliminam a cobrança restante. A renegociação mantém as parcelas excluídas e reparcela somente o saldo ativo. Alteração, quitação e ajuste de recebimento da parcela excluída são bloqueados.
- Operações financeiras compartilham a ordem de bloqueio: venda, título, parcelas. Consultas com associações opcionais não bloqueiam o lado nullable dos joins.

## Tela

Todas as exclusões do A receber solicitam motivo e depois uma confirmação dos valores. O segundo modal mostra recebido preservado, saldo eliminado e saldo total devido antes/depois. Voltar preserva o motivo.

O `GlobalMutationLoadingOverlay` existente cobre os modais durante o envio. Os botões e o fechamento são bloqueados pelo loading; `deleteRequest` impede requisições de mutação simultâneas. A simulação usa o mesmo componente visual com estado local.

Parcelas excluídas ficam no filtro Todas e no detalhe da venda, esmaecidas, com status Excluída e saldo zero. O histórico financeiro é preservado.

## Implantação e testes

Aplicar as migrations `20260914100000-add-installment-deletion-audit.js` e `20260914101000-add-installment-waived-amount.js` antes de publicar o backend. Atualizar frontend e backend juntos: clientes antigos sem `previewToken` não poderão excluir.

As migrations são idempotentes e possuem `down`. Remover as colunas elimina os metadados da exclusão e não restaura cobranças; não fazer rollback da aplicação enquanto houver registros excluídos sem avaliar essa incompatibilidade.

- Backend: `npm test`.
- Integração PostgreSQL: no PowerShell, `$env:RUN_DB_TESTS='1'`, depois `npm test` no backend. Usa exclusivamente o `DATABASE_URL` local e cria um schema temporário isolado, removido no final. Testa up/down, FK, concorrência, rollback, renegociação e dashboard.
- Frontend: `node --test tests/mutationLoading.test.cjs` e `npm run build`.
- Validação visual: motivo obrigatório, Voltar preservando texto, valores antes/depois, loading acima dos dois modais, apenas uma exclusão em clique repetido e registros esmaecidos sem ações financeiras.
