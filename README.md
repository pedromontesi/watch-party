Watch Party

Sistema de watch party online com compartilhamento de tela em tempo real, usando WebRTC para transmissão peer-to-peer e Socket.io para sinalização.

Tecnologias


Frontend: React + TypeScript + Vite
Backend: Node.js + Express + TypeScript
Tempo real: Socket.io
Transmissão: WebRTC (getDisplayMedia)
Roteamento: React Router DOM


Como rodar

Pré-requisitos


Node.js 18+
npm


1. Instalar dependências

bash# Frontend (na raiz)
npm install

# Backend
cd server && npm install

2. Rodar o servidor

bashcd server
npm run dev

O servidor sobe em http://localhost:3001.

3. Rodar o frontend

bash# na raiz do projeto
npm run dev

O frontend sobe em http://localhost:5173.


Mantenha os dois terminais abertos ao mesmo tempo.



Como usar

Criar uma sala (host)


Acesse http://localhost:5173
Clique em Criar sala
Você será redirecionado para uma URL com 6 caracteres, ex: http://localhost:5173/xK9mPq
Clique em Compartilhar tela — o browser vai pedir permissão para capturar a tela
Compartilhe o link com quem quiser convidar


Entrar em uma sala (viewer)


Acesse o link compartilhado diretamente, ou
Na tela inicial, digite o código de 6 caracteres e clique em Entrar