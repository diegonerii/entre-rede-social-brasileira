# entre

Uma rede social brasileira para textos, fotografias, vídeos, conversas e comunidades. A entre combina um feed editorial com as ações clássicas de rede social e duas ideias que mereciam voltar: comunidades e depoimentos.

## O que existe na primeira versão

- Feed “Para você”, “Seguindo” e “Comunidades”, com paginação por cursor.
- Publicações de texto, foto (JPG, PNG, WEBP) e vídeo (MP4, WEBM), com tags e publicação em comunidades.
- Curtir, não gostei, comentar, repostar, guardar, denunciar e excluir a própria publicação.
- Perfis editáveis, seguir/deixar de seguir, sugestões por conexões e interesses, bloqueio e cópia de link.
- Comunidades públicas, participação, criação de comunidade e feed próprio.
- Mensagens privadas com caixa de entrada, leitura, polling e bloqueio entre participantes.
- Depoimentos com aprovação obrigatória de quem recebe antes de aparecerem no perfil.
- Notificações para seguir, comentar, repostar e receber depoimento.
- Uploads no R2 com validação de assinatura de arquivo, limite de 25 MB e resposta com headers seguros.
- Interface mobile-first com fallback desktop, navegação por hash para manter a navegação simples e acessível.

## Identidade visual

O design segue uma direção editorial e brasileira: marfim, verde profundo, verde-lima suave, serif expressiva para títulos e DM Sans para leitura. A marca usa “entre” como uma ideia de espaço e encontro, com microtipografia em português e sem emojis de sistema ou mensagens genéricas de template.

## Desenvolvimento local

Requisitos: Node 22.13+.

```powershell
npm ci
npm run db:generate
npm run build
npm run dev -- --port 4173
```

O ambiente local fornece a identidade de desenvolvimento `Seedy` via mock auth. Depois do build, aplique as migrações no D1 local antes de abrir o feed:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_luxuriant_otto_octavius.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_seed_entre_examples.sql
```

`npm run build` e `npx tsc --noEmit` são as validações mínimas do projeto. O deploy é feito pelo workflow do Sites e aplica as migrações pendentes no D1; não há deploy automático a partir de um script de desenvolvimento.

## Dados e privacidade

O schema fica em `db/schema.ts` e as migrações em `drizzle/`. A identidade de produção é fornecida pelo login da plataforma, usando `oai-authenticated-user-id` como chave estável. O conteúdo de posts e uploads é público por design; mensagens e relações de bloqueio são verificadas no servidor. Não há segredos no repositório.

## Deploy na Magalu Cloud

O caminho de runtime equivalente a um serviço de container gerenciado é Kubernetes + Container Registry. O container expõe a porta `8787`, executa o worker Vinext/Wrangler e persiste o D1/R2 local do runtime no volume `/data`. O manifesto de referência está em `infra/magalu/kubernetes.yaml`.

Com a conta Magalu Cloud ativada e Docker, `mgc` e `kubectl` configurados:

```powershell
docker build -t container-registry.br-se1.magalu.cloud/entre/entre:latest .
mgc container-registry registries create --name entre
mgc container-registry credentials get
docker login container-registry.br-se1.magalu.cloud
docker push container-registry.br-se1.magalu.cloud/entre/entre:latest
mgc kubernetes cluster kubeconfig get --cluster-id <cluster-id> > kubeconfig.yaml
$env:KUBECONFIG = "$(Resolve-Path .\\kubeconfig.yaml)"
kubectl apply -f infra/magalu/kubernetes.yaml
kubectl -n entre get service entre
```

Para produção com múltiplas réplicas, substitua o armazenamento local por DBaaS e Object Storage da Magalu Cloud. O manifesto inicial usa uma réplica e PVC para manter o estado do MVP sem esconder essa limitação.

## Estrutura

- `app/social-app.tsx`: experiência do produto e navegação.
- `app/server/api.ts`: regras de autenticação, autorização, validação e operações de dados.
- `app/api/[...path]/route.ts`: adaptador de rotas para o worker.
- `db/schema.ts`: tabelas de usuários, posts, reações, comunidades, mensagens, notificações e depoimentos.
- `.openai/hosting.json`: bindings D1/R2 (`DB` e `BUCKET`).
