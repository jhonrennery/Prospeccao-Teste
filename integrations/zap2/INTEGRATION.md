# Zap2 Integration Boundary

Este modulo foi importado como aplicacao isolada a partir do template `zap2-whatsapp-web-template`.

## Responsabilidades do modulo

- Interface WhatsApp Web baseada em Next.js
- Gateway Baileys do proprio modulo
- Persistencia PostgreSQL propria do template
- Midias e credenciais locais do modulo

## Responsabilidades do app principal

- Autenticacao principal do produto
- Menu lateral e rota de entrada `/whatsapp`
- Proxy/reverse proxy para expor o modulo
- Banco principal do CRM

## Regra de manutencao

Nao espalhar arquivos do Zap2 para `src/` do app principal.

Se houver adaptacoes:

1. priorizar mudancas dentro de `integrations/zap2`
2. manter o app principal apenas com a bridge de entrada e infraestrutura
3. tratar SQL do template em pasta separada para aplicacao manual
