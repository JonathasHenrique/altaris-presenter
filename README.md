# 🌟 OpenPresenter (Linux Worship & Broadcast Engine)

Software potente, ultra-rápido e 100% open-source para projeção em igrejas e transmissões no Linux.
Combina o melhor de **Holyrics**, **ProPresenter** e **OpenLP** em uma arquitetura de alta performance com **Rust**, **Tauri v2**, **TypeScript** e **Compositor Gráfico WebGL/Canvas a 60 FPS**.

---

## 🚀 Fusão das Principais Funções

| Funcionalidade | Inspirado em | Como funciona no OpenPresenter |
|---|---|---|
| **Motor Multi-Camada (Layers)** | **ProPresenter** | Renderização acelerada por GPU a 60 FPS: Fundo em movimento (Shaders/Vídeos), Camada de Letras, Props (Logos/QR Codes) e Alertas. |
| **Multi-Screen ("Looks" Independentes)** | **ProPresenter** | Um único slide gera saídas personalizadas simultâneas: **Telão Principal** (16:9 cinematográfico), **Retorno de Palco** (alto contraste com cifras) e **Transmissão OBS** (Lower-Third transparente). |
| **Busca Bíblica Instantânea** | **Holyrics** | Digitação rápida sem menus: digite `jo 3 16`, `sl 23`, `gn 1 1` ou `ap 22 20` para projetar instantaneamente. |
| **Cifras Integradas & Transposição** | **Holyrics** | Músicos visualizam cifras no monitor de retorno, com transposição de tom (+1 / -1 semitom) em tempo real. |
| **Painel de Avisos & Ticker** | **Holyrics** | Mensagens rolantes, avisos de berçário e cronômetros com transmissão imediata para todas as telas. |
| **OBS Studio Lower-Third Direto** | **Holyrics / ProPresenter** | Fonte de navegador 100% transparente com canal alpha (`http://localhost:5173/stream.html`), sem necessidade de Chroma Key. |
| **Controle Remoto Mobile (PWA)** | **Holyrics / OpenLP** | Qualquer celular ou tablet na rede Wi-Fi pode controlar o culto acessando `http://[IP-DO-LINUX]:5173/remote.html`. |
| **Estrutura Aberta & Ordem do Culto** | **OpenLP** | Gerenciamento de playlists litúrgicas, compatibilidade com bancos SQLite, ChordPro e formatos abertos. |

---

## 🛠️ REA (Reverse Engineer Anything) Configurado

O **REA** (`rea.tools` / `rea-agents`) já foi instalado e configurado como servidor MCP integrado ao **Antigravity**.
Ele foi utilizado para inspecionar os instaladores:
- `Holyrics-setup-64.exe` (descompactado via `innoextract`, revelando bases de bíblias, cifras e protocolo WebSocket)
- `ProPresenter_21.4.2_352584193-Setup.exe` (estrutura de camadas e recursos)
- `OpenLP-3.1.7.tar.gz` (esquema SQLite de bíblias e hinos)

Para rodar diagnósticos do REA a qualquer momento:
```bash
rea doctor --client antigravity --json
```

---

## 🖥️ Telas e Endereços Disponíveis

Com o servidor rodando (`npm run dev` ou `npm run preview`):

1. **Centro de Controle do Operador**: [http://localhost:5173/](http://localhost:5173/)
2. **Telão Principal (Projetor)**: [http://localhost:5173/audience.html](http://localhost:5173/audience.html)
3. **Retorno de Palco (Músicos/Pregador)**: [http://localhost:5173/stage.html](http://localhost:5173/stage.html)
4. **Overlay Transparente para OBS**: [http://localhost:5173/stream.html](http://localhost:5173/stream.html)
5. **Controle Remoto para Celular**: `http://<SEU-IP-LOCAL>:5173/remote.html`

---

## ⌨️ Atalhos de Teclado no Centro de Controle

- **Barra de Espaço** ou **Seta para Direita**: Avançar para o próximo slide
- **Backspace** ou **Seta para Esquerda**: Voltar ao slide anterior
- **F1**: Alternar modo **Blackout** (apaga saídas de vídeo instantaneamente)
- **F2**: Alternar modo **Clear Text** (oculta o texto mas mantém o fundo/vídeo)
- **Barra de Pesquisa**: Digite abreviações de livros e capítulos (ex: `sl 91 1`) para encontrar versículos na hora

---

## 📦 Compilação do Executável Nativo Linux (Tauri v2 + Rust)

Para compilar o binário desktop nativo com janelas independentes no Fedora Linux:

1. Instale os pacotes de compilação no Fedora:
```bash
sudo dnf install -y cargo rust gcc webkit2gtk4.1-devel openssl-devel
```

2. Execute em modo de desenvolvimento Tauri:
```bash
npm run tauri dev
```

3. Ou gere o pacote `.rpm` / binário otimizado:
```bash
npm run tauri build
```
