O **Modelo C4** é uma abordagem de abstração e notação para modelagem e documentação de arquitetura de software, criada por Simon Brown, que funciona de forma hierárquica e progressiva — similar ao funcionamento do Google Maps (onde é possível visualizar um país inteiro e ir aplicando zoom até o nível da rua).

Em vez de usar diagramas complexos em notações pesadas como a UML tradicional, o C4 divide a arquitetura de software em **4 níveis de detalhamento** (Contexto, Contêineres, Componentes e Código).

---

### Os 4 Níveis do Diagrama C4

1. **Nível 1: Contexto do Sistema (System Context)**
* **Objetivo:** Mostrar a visão geral e o escopo do ecossistema.
* **O que exibe:** O sistema que está sendo construído no centro, os usuários (pessoas/atores) que interagem com ele e os sistemas externos com os quais ele se integra.
* **Público-alvo:** Pessoas técnicas e não técnicas (gerentes de produto, executivos, novos desenvolvedores).


2. **Nível 2: Contêineres (Containers)**
* **Objetivo:** Detalhar a arquitetura de alto nível do sistema.
* **O que exibe:** As unidades executáveis e de armazenamento que compõem o sistema (ex.: aplicação web React, API backend Node.js, banco de dados PostgreSQL, aplicativo mobile, microserviços) e os protocolos de comunicação entre eles (HTTP, gRPC, AMQP).
* *Nota:* "Contêiner" aqui se refere a uma unidade de código/execução e não exclusivamente a contêineres Docker.
* **Público-alvo:** Desenvolvedores, arquitetos e equipe de infraestrutura/DevOps.


3. **Nível 3: Componentes (Components)**
* **Objetivo:** Decompor um contêiner específico em suas partes estruturais.
* **O que exibe:** Os módulos funcionais e abstrações de código dentro de um único contêiner (ex.: Controller de Autenticação, Serviço de Pagamento, Repositório de Dados) e como eles se relacionam.
* **Público-alvo:** Desenvolvedores e arquitetos trabalhando diretamente naquele projeto.


4. **Nível 4: Código (Code)**
* **Objetivo:** Mostrar a implementação de um componente individual.
* **O que exibe:** Diagramas de classe (UML), modelos entidade-relacionamento (DER) ou código-fonte detalhado.
* **Público-alvo:** Desenvolvedores.
* *Nota:* Este nível é opcional e raramente desenhado manualmente; geralmente é gerado automaticamente por IDEs ou ferramentas de código quando necessário.



---

### Principais Benefícios

* **Linguagem Universal:** Utiliza caixas simples, texto claro, cores e vetores de direcionamento, dispensando o aprendizado de regras rígidas de UML.
* **Comunicação Direcionada:** Permite apresentar a mesma arquitetura para executivos (usando o Nível 1) ou para desenvolvedores sêniores (usando os Níveis 2 e 3) sem sobrecarregar ninguém com detalhes irrelevantes.
* **Manutenibilidade:** Facilita a atualização da documentação, pois mudanças em um módulo interno costumam afetar apenas os diagramas de Nível 3 ou 4, sem alterar a visão global do Nível 1.