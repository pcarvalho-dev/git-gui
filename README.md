# Git GUI

Uma aplicação desktop moderna de Git GUI construída com Tauri, React e TypeScript, inspirada no GitKraken.

## Funcionalidades

- ✅ Visualização interativa de grafo de commits
- ✅ Gerenciamento de staging e commit
- ✅ Gerenciamento completo de branches
- ✅ Histórico de commits com busca
- ✅ Visualizador de diff
- ✅ Integração com repositórios remotos (push/pull/fetch)
- ✅ Gerenciamento de stash
- ✅ Interface moderna com tema dark/light
- ✅ Performance otimizada com Tauri

## Tecnologias

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Tauri 2.0 (Rust)
- **UI**: Tailwind CSS + shadcn/ui
- **Git**: libgit2 via git2-rs
- **Visualização**: D3.js para grafo de commits
- **State Management**: Zustand

## Pré-requisitos

- Node.js 18+ e npm
- Rust e Cargo (instalados via [rustup](https://rustup.rs/))
- Git instalado no sistema

### Instalando o Rust

Se você ainda não tem o Rust instalado:

1. **Windows**: Baixe e execute o instalador do [rustup](https://rustup.rs/)
   ```powershell
   # Ou via PowerShell (recomendado):
   # Baixe de https://rustup.rs/ e execute o instalador
   ```

2. **Verifique a instalação**:
   ```bash
   rustc --version
   cargo --version
   ```

3. **Instale o Visual Studio Build Tools** (necessário para compilar no Windows):
   - Baixe: https://visualstudio.microsoft.com/downloads/
   - Selecione "Build Tools for Visual Studio"
   - Durante a instalação, marque **"Desktop development with C++"**
   - Isso instala o linker `link.exe` necessário para compilar Rust no Windows

4. **Após instalar, reinicie o terminal** para que as variáveis de ambiente sejam carregadas.

## Instalação

1. Clone o repositório:
```bash
git clone <repo-url>
cd git-gui
```

2. Instale as dependências do frontend:
```bash
npm install
```

3. Instale as dependências do Rust (Tauri):
```bash
cd src-tauri
cargo build
cd ..
```

## Desenvolvimento

Para executar em modo de desenvolvimento:

```bash
npm run tauri:dev
```

## Build

Para criar um executável:

```bash
npm run tauri:build
```

Os executáveis serão gerados em `src-tauri/target/release/`.

## Uso

1. Inicie a aplicação
2. Clique em "Abrir Repositório" e selecione o caminho do seu repositório Git
3. Explore as diferentes visualizações através da barra lateral:
   - **Grafo**: Visualização interativa do histórico de commits
   - **Arquivos**: Gerenciar staging e criar commits
   - **Branches**: Gerenciar branches locais e remotas
   - **Histórico**: Lista de commits com busca
   - **Stash**: Gerenciar stashes
   - **Remotos**: Push, pull e fetch

## Estrutura do Projeto

```
git-gui/
├── src/                    # Frontend React
│   ├── components/         # Componentes React
│   ├── stores/             # Estado global (Zustand)
│   ├── types/              # TypeScript types
│   └── lib/                # Utilitários
├── src-tauri/              # Backend Rust
│   ├── src/
│   │   ├── main.rs         # Entry point
│   │   ├── commands.rs     # Comandos Tauri
│   │   └── git.rs          # Wrapper Git
│   └── Cargo.toml
└── package.json
```

## Licença

MIT

