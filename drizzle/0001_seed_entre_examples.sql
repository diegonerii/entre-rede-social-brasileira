-- Small editorial seed so a fresh install has a living starting point.
-- All records are explicitly marked as examples in the UI by their copy.
INSERT OR IGNORE INTO users(id,handle,name,bio,avatar,location,interests,created_at) VALUES
('seed-lia','lia-costa','Lia Costa','Fotografo o que insiste em ficar.','', 'São Paulo, SP','fotografia, cotidiano', 1735689600000),
('seed-caio','caio-luz','Caio Luz','Café passado, discos riscados e boas perguntas.','', 'Recife, PE','música, literatura', 1735776000000),
('seed-joana','joana-moura','Joana Moura','Faço mapas de lugares que só existem depois da conversa.','', 'Belém, PA','arte, viagens', 1735862400000),
('seed-bia','biaduarte','Bia Duarte','Cinema brasileiro, plantas difíceis e um caderno aberto.','', 'Belo Horizonte, MG','cinema, plantas', 1735948800000);
INSERT OR IGNORE INTO communities(id,name,description,category,color,owner_id,created_at) VALUES
('com-foto-de-rua','Foto de rua','A cidade muda quando a gente aprende a olhar devagar.','Fotografia','#d9dfca','seed-lia',1735689600000),
('com-disco-lado-b','Disco lado B','Canções para ouvir quando ninguém está pedindo pressa.','Música','#e4d8c7','seed-caio',1735776000000),
('com-cinema-br','Cinema brasileiro','Filmes que ficam na cabeça depois da sessão.','Cinema','#d9d9cb','seed-bia',1735862400000),
('com-pequenas-coisas','Pequenas coisas','Um lugar para reparar no que quase passa despercebido.','Cotidiano','#d7e2d0','seed-joana',1735948800000);
INSERT OR IGNORE INTO memberships(user_id,community_id) VALUES
('seed-lia','com-foto-de-rua'),('seed-caio','com-disco-lado-b'),('seed-bia','com-cinema-br'),('seed-joana','com-pequenas-coisas'),
('seed-caio','com-foto-de-rua'),('seed-lia','com-pequenas-coisas'),('seed-bia','com-pequenas-coisas');
INSERT OR IGNORE INTO posts(id,user_id,community_id,kind,title,body,media,tags,created_at) VALUES
('post-seed-lia','seed-lia','com-foto-de-rua','text','A luz entre uma coisa e outra','Tem uma hora da tarde em que a cidade parece pedir licença para mudar de cor. Hoje eu fiquei ali, no meio do caminho, só olhando.','','fotografia,cotidiano',1735948800000),
('post-seed-caio','seed-caio','com-disco-lado-b','text','','Descobri que algumas músicas não querem ser descobertas. Elas só ficam por perto até a gente estar pronto para escutar.','','música,escuta',1736035200000),
('post-seed-bia','seed-bia','com-cinema-br','text','Filme para uma terça sem pressa','Assisti a um filme antigo e, pela primeira vez, entendi que saudade também pode ser uma forma de atenção.','','cinema,filmes',1736121600000),
('post-seed-joana','seed-joana','com-pequenas-coisas','text','','Hoje uma senhora na fila do pão me contou a história inteira de uma árvore. Eu não perguntei nada.','','cotidiano,brasil',1736208000000);
INSERT OR IGNORE INTO follows(follower_id,following_id) VALUES ('seed-lia','seed-caio'),('seed-caio','seed-bia'),('seed-bia','seed-lia');
