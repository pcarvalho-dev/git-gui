import { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { useTerminalStore, ShellType } from '@/stores/terminalStore';
import { useThemeStore } from '@/stores/themeStore';
import { Button } from '@/components/ui/button';
import { X, Minus, Maximize2, Minimize2, Terminal as TerminalIcon, GripHorizontal, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import '@xterm/xterm/css/xterm.css';

const darkTheme = {
  background: '#1e1e2e',
  foreground: '#cdd6f4',
  cursor: '#f5e0dc',
  cursorAccent: '#1e1e2e',
  selectionBackground: '#585b70',
  black: '#45475a',
  red: '#f38ba8',
  green: '#a6e3a1',
  yellow: '#f9e2af',
  blue: '#89b4fa',
  magenta: '#f5c2e7',
  cyan: '#94e2d5',
  white: '#bac2de',
  brightBlack: '#585b70',
  brightRed: '#f38ba8',
  brightGreen: '#a6e3a1',
  brightYellow: '#f9e2af',
  brightBlue: '#89b4fa',
  brightMagenta: '#f5c2e7',
  brightCyan: '#94e2d5',
  brightWhite: '#a6adc8',
};

const lightTheme = {
  background: '#eff1f5',
  foreground: '#4c4f69',
  cursor: '#dc8a78',
  cursorAccent: '#eff1f5',
  selectionBackground: '#acb0be',
  black: '#5c5f77',
  red: '#d20f39',
  green: '#40a02b',
  yellow: '#df8e1d',
  blue: '#1e66f5',
  magenta: '#ea76cb',
  cyan: '#179299',
  white: '#acb0be',
  brightBlack: '#6c6f85',
  brightRed: '#d20f39',
  brightGreen: '#40a02b',
  brightYellow: '#df8e1d',
  brightBlue: '#1e66f5',
  brightMagenta: '#ea76cb',
  brightCyan: '#179299',
  brightWhite: '#bcc0cc',
};

const SHELL_LABELS: Record<ShellType, string> = {
  powershell: 'PowerShell',
  cmd: 'CMD',
  wsl: 'WSL',
  gitbash: 'Git Bash',
};

export default function Terminal() {
  const { isOpen, height, closeTerminal, setHeight, shellType, setShellType } = useTerminalStore();
  const { theme } = useThemeStore();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const commandBufferRef = useRef('');
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);
  const initializedRef = useRef(false);
  const [currentDir, setCurrentDir] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const previousHeightRef = useRef(250);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  const writePrompt = useCallback((xterm: XTerm, dir: string) => {
    const shortDir = dir.split(/[/\\]/).pop() || dir;
    xterm.write(`\x1b[32m${shortDir}\x1b[0m \x1b[34m>\x1b[0m `);
  }, []);

  const executeCommand = useCallback(async (command: string, xterm: XTerm) => {
    const trimmedCmd = command.trim();

    if (!trimmedCmd) {
      writePrompt(xterm, currentDir);
      return;
    }

    // Add to history
    if (historyRef.current[historyRef.current.length - 1] !== trimmedCmd) {
      historyRef.current.push(trimmedCmd);
    }
    historyIndexRef.current = historyRef.current.length;

    // Handle built-in commands
    if (trimmedCmd === 'clear' || trimmedCmd === 'cls') {
      xterm.clear();
      writePrompt(xterm, currentDir);
      return;
    }

    if (trimmedCmd.startsWith('cd ')) {
      const newPath = trimmedCmd.slice(3).trim().replace(/^["']|["']$/g, '');
      setIsExecuting(true);
      try {
        // Handle relative paths
        let targetPath = newPath;
        if (!newPath.match(/^[a-zA-Z]:[/\\]/) && !newPath.startsWith('/')) {
          targetPath = `${currentDir}/${newPath}`;
        }
        await invoke('terminal_set_dir', { path: targetPath });
        const dir = await invoke<string>('terminal_get_dir');
        setCurrentDir(dir);
        writePrompt(xterm, dir);
      } catch (err) {
        xterm.writeln(`\x1b[31m${err}\x1b[0m`);
        writePrompt(xterm, currentDir);
      }
      setIsExecuting(false);
      return;
    }

    setIsExecuting(true);
    try {
      const output = await invoke<string>('terminal_execute', { command: trimmedCmd });
      if (output.trim()) {
        // Write output line by line
        const lines = output.split('\n');
        for (const line of lines) {
          xterm.writeln(line.replace(/\r$/, ''));
        }
      }
    } catch (err) {
      xterm.writeln(`\x1b[31mErro: ${err}\x1b[0m`);
    }
    setIsExecuting(false);
    writePrompt(xterm, currentDir);
  }, [currentDir, writePrompt]);

  // Initialize terminal
  useEffect(() => {
    if (!isOpen || !terminalRef.current || initializedRef.current) return;

    const colors = theme === 'dark' ? darkTheme : lightTheme;
    const xterm = new XTerm({
      theme: colors,
      fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: false,
      scrollback: 5000,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalRef.current);

    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch {
        // Ignore
      }
    }, 100);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;
    initializedRef.current = true;

    // Handle user input
    xterm.onData((data) => {
      if (isExecuting) return;

      if (data === '\r') {
        // Enter
        xterm.write('\r\n');
        const cmd = commandBufferRef.current;
        commandBufferRef.current = '';
        executeCommand(cmd, xterm);
      } else if (data === '\x7f' || data === '\b') {
        // Backspace
        if (commandBufferRef.current.length > 0) {
          commandBufferRef.current = commandBufferRef.current.slice(0, -1);
          xterm.write('\b \b');
        }
      } else if (data === '\x03') {
        // Ctrl+C
        xterm.write('^C\r\n');
        commandBufferRef.current = '';
        writePrompt(xterm, currentDir || '~');
      } else if (data === '\x1b[A') {
        // Arrow Up - history
        if (historyIndexRef.current > 0) {
          historyIndexRef.current--;
          const cmd = historyRef.current[historyIndexRef.current];
          // Clear current line
          xterm.write('\r\x1b[K');
          writePrompt(xterm, currentDir || '~');
          xterm.write(cmd);
          commandBufferRef.current = cmd;
        }
      } else if (data === '\x1b[B') {
        // Arrow Down - history
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current++;
          const cmd = historyRef.current[historyIndexRef.current];
          xterm.write('\r\x1b[K');
          writePrompt(xterm, currentDir || '~');
          xterm.write(cmd);
          commandBufferRef.current = cmd;
        } else if (historyIndexRef.current === historyRef.current.length - 1) {
          historyIndexRef.current = historyRef.current.length;
          xterm.write('\r\x1b[K');
          writePrompt(xterm, currentDir || '~');
          commandBufferRef.current = '';
        }
      } else if (data >= ' ') {
        commandBufferRef.current += data;
        xterm.write(data);
      }
    });

    // Initialize terminal
    xterm.writeln(`\x1b[1;34m=== Git GUI Terminal (${SHELL_LABELS[shellType]}) ===\x1b[0m`);
    xterm.writeln('Digite comandos. Use \x1b[33mcd\x1b[0m para navegar, \x1b[33mclear\x1b[0m para limpar.\r\n');

    // Set shell type and initialize
    invoke('terminal_set_shell', { shellType })
      .then(() => invoke<string>('terminal_init'))
      .then((dir) => {
        setCurrentDir(dir);
        writePrompt(xterm, dir);
      })
      .catch((err) => {
        xterm.writeln(`\x1b[31mErro ao inicializar: ${err}\x1b[0m`);
        setCurrentDir('~');
        writePrompt(xterm, '~');
      });

    return () => {
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
      commandBufferRef.current = '';
    };
  }, [isOpen, shellType]);

  // Update theme
  useEffect(() => {
    if (xtermRef.current && initializedRef.current) {
      xtermRef.current.options.theme = theme === 'dark' ? darkTheme : lightTheme;
    }
  }, [theme]);

  // Fit on height change
  useEffect(() => {
    if (!isOpen || !fitAddonRef.current || !initializedRef.current) return;
    const timeoutId = setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
      } catch {
        // Ignore
      }
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [isOpen, height]);

  // Window resize
  useEffect(() => {
    if (!isOpen || !initializedRef.current) return;
    const handleResize = () => {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {
          // Ignore
        }
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Drag resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = height;
  }, [height]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartY.current - e.clientY;
      setHeight(resizeStartHeight.current + delta);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      setIsMaximized(false); // Reset maximized state on manual resize
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {
          // Ignore
        }
      }, 50);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setHeight]);

  const handleTerminalClick = useCallback(() => {
    xtermRef.current?.focus();
  }, []);

  const toggleMaximize = useCallback(() => {
    if (isMaximized) {
      setHeight(previousHeightRef.current);
      setIsMaximized(false);
    } else {
      previousHeightRef.current = height;
      // Calculate ~80% of viewport height
      const maxHeight = Math.floor(window.innerHeight * 0.8);
      setHeight(maxHeight);
      setIsMaximized(true);
    }
    setTimeout(() => {
      try {
        fitAddonRef.current?.fit();
      } catch {
        // Ignore
      }
    }, 50);
  }, [isMaximized, height, setHeight]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'flex flex-col border-t border-border bg-card',
        isResizing && 'select-none'
      )}
      style={{ height }}
    >
      {/* Resize handle */}
      <div
        className="h-1 cursor-ns-resize bg-border hover:bg-primary/50 transition-colors flex items-center justify-center group"
        onMouseDown={handleMouseDown}
      >
        <GripHorizontal className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TerminalIcon className="w-4 h-4" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                <span>{SHELL_LABELS[shellType]}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setShellType('powershell')}>
                <span className={shellType === 'powershell' ? 'font-semibold' : ''}>PowerShell</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShellType('cmd')}>
                <span className={shellType === 'cmd' ? 'font-semibold' : ''}>CMD</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShellType('wsl')}>
                <span className={shellType === 'wsl' ? 'font-semibold' : ''}>WSL</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShellType('gitbash')}>
                <span className={shellType === 'gitbash' ? 'font-semibold' : ''}>Git Bash</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {currentDir && (
            <span className="text-xs opacity-60 truncate max-w-[200px]">{currentDir}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={toggleMaximize}
            title={isMaximized ? "Restaurar" : "Maximizar"}
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setHeight(100);
              setIsMaximized(false);
            }}
            title="Minimizar"
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={closeTerminal}
            title="Fechar"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Terminal container */}
      <div
        className="flex-1 overflow-hidden p-1"
        onClick={handleTerminalClick}
      >
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    </div>
  );
}
