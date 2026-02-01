import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore, ThemeMode, DefaultView } from '@/stores/settingsStore';
import { useThemeStore } from '@/stores/themeStore';
import { useTerminalStore, ShellType } from '@/stores/terminalStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import {
  Settings as SettingsIcon,
  Palette,
  Terminal,
  GitBranch,
  Monitor,
  RotateCcw,
  Save,
  Info,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useUpdateChecker } from '@/hooks/useUpdateChecker';
import { getVersion } from '@tauri-apps/api/app';
import { cn } from '@/lib/utils';

interface SettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenUpdateDialog?: () => void;
}

type SettingsTab = 'appearance' | 'editor' | 'terminal' | 'git' | 'behavior' | 'about';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'appearance', label: 'Aparência', icon: Palette },
  { id: 'editor', label: 'Editor', icon: Monitor },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'git', label: 'Git', icon: GitBranch },
  { id: 'behavior', label: 'Comportamento', icon: SettingsIcon },
  { id: 'about', label: 'Sobre', icon: Info },
];

const VIEW_OPTIONS: { value: DefaultView; label: string }[] = [
  { value: 'files', label: 'Arquivos' },
  { value: 'graph', label: 'Grafo' },
  { value: 'branches', label: 'Branches' },
  { value: 'history', label: 'Histórico' },
  { value: 'stash', label: 'Stash' },
  { value: 'remote', label: 'Remotos' },
  { value: 'pr', label: 'Pull Requests' },
];

const SHELL_OPTIONS: { value: ShellType; label: string }[] = [
  { value: 'powershell', label: 'PowerShell' },
  { value: 'cmd', label: 'CMD' },
  { value: 'wsl', label: 'WSL' },
  { value: 'gitbash', label: 'Git Bash' },
];

const FONT_FAMILIES = [
  { value: 'system-ui, -apple-system, sans-serif', label: 'Sistema' },
  { value: '"Segoe UI", sans-serif', label: 'Segoe UI' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
];

const MONO_FONT_FAMILIES = [
  { value: '"Cascadia Code", "JetBrains Mono", monospace', label: 'Cascadia Code' },
  { value: '"JetBrains Mono", monospace', label: 'JetBrains Mono' },
  { value: '"Fira Code", monospace', label: 'Fira Code' },
  { value: 'Consolas, monospace', label: 'Consolas' },
  { value: '"Source Code Pro", monospace', label: 'Source Code Pro' },
];

export default function Settings({ open, onOpenChange, onOpenUpdateDialog }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [appVersion, setAppVersion] = useState<string>('');
  const { toast } = useToast();
  const { theme, setTheme } = useThemeStore();
  const { shellType, setShellType } = useTerminalStore();
  const {
    checking: updateChecking,
    available: updateAvailable,
    update,
    error: updateError,
    checkForUpdate,
  } = useUpdateChecker();

  const settings = useSettingsStore();

  // Local state for Git settings (need to be saved to git config)
  const [gitName, setGitName] = useState(settings.gitUserName);
  const [gitEmail, setGitEmail] = useState(settings.gitUserEmail);

  // Load app version
  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion('?.?.?'));
  }, []);

  // Load git config on open
  useEffect(() => {
    if (open) {
      invoke<string | null>('get_git_config_value', { key: 'user.name' })
        .then((name) => {
          if (name) {
            setGitName(name);
            settings.setGitUserName(name);
          }
        })
        .catch(() => {});

      invoke<string | null>('get_git_config_value', { key: 'user.email' })
        .then((email) => {
          if (email) {
            setGitEmail(email);
            settings.setGitUserEmail(email);
          }
        })
        .catch(() => {});
    }
  }, [open]);

  const handleSaveGitConfig = async () => {
    try {
      if (gitName) {
        await invoke('set_git_config_value', { key: 'user.name', value: gitName });
        settings.setGitUserName(gitName);
      }
      if (gitEmail) {
        await invoke('set_git_config_value', { key: 'user.email', value: gitEmail });
        settings.setGitUserEmail(gitEmail);
      }
      toast({ title: 'Configurações Git salvas' });
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: String(err),
        variant: 'destructive',
      });
    }
  };

  const handleThemeModeChange = (mode: ThemeMode) => {
    settings.setThemeMode(mode);
    if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    } else {
      setTheme(mode);
    }
  };

  const handleResetToDefaults = () => {
    settings.resetToDefaults();
    setTheme('dark');
    setShellType('powershell');
    toast({ title: 'Configurações restauradas para o padrão' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[600px] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Configurações
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r bg-muted/30">
            <nav className="p-2 space-y-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
                      activeTab === tab.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            <Separator className="my-2" />

            <div className="p-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleResetToDefaults}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Restaurar Padrão
              </Button>
            </div>
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Appearance */}
              {activeTab === 'appearance' && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Aparência</h3>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Tema</Label>
                        <Select
                          value={settings.themeMode}
                          onValueChange={(v) => handleThemeModeChange(v as ThemeMode)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">Claro</SelectItem>
                            <SelectItem value="dark">Escuro</SelectItem>
                            <SelectItem value="system">Sistema</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Tema atual: {theme === 'dark' ? 'Escuro' : 'Claro'}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Fonte da Interface</Label>
                        <Select
                          value={settings.fontFamily}
                          onValueChange={settings.setFontFamily}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FONT_FAMILIES.map((font) => (
                              <SelectItem key={font.value} value={font.value}>
                                {font.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Tamanho da Fonte: {settings.fontSize}px</Label>
                        <Slider
                          value={[settings.fontSize]}
                          onValueChange={([v]) => settings.setFontSize(v)}
                          min={10}
                          max={20}
                          step={1}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Editor */}
              {activeTab === 'editor' && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Editor de Código</h3>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Fonte do Editor</Label>
                        <Select
                          value={settings.editorFontFamily}
                          onValueChange={settings.setEditorFontFamily}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MONO_FONT_FAMILIES.map((font) => (
                              <SelectItem key={font.value} value={font.value}>
                                {font.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Tamanho da Fonte: {settings.editorFontSize}px</Label>
                        <Slider
                          value={[settings.editorFontSize]}
                          onValueChange={([v]) => settings.setEditorFontSize(v)}
                          min={10}
                          max={24}
                          step={1}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tamanho do Tab: {settings.editorTabSize} espaços</Label>
                        <Slider
                          value={[settings.editorTabSize]}
                          onValueChange={([v]) => settings.setEditorTabSize(v)}
                          min={2}
                          max={8}
                          step={2}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Quebra de Linha</Label>
                          <p className="text-xs text-muted-foreground">
                            Quebrar linhas longas automaticamente
                          </p>
                        </div>
                        <Switch
                          checked={settings.editorWordWrap}
                          onCheckedChange={settings.setEditorWordWrap}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Terminal */}
              {activeTab === 'terminal' && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Terminal</h3>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Shell Padrão</Label>
                        <Select
                          value={shellType}
                          onValueChange={(v) => {
                            setShellType(v as ShellType);
                            settings.setDefaultShell(v as ShellType);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SHELL_OPTIONS.map((shell) => (
                              <SelectItem key={shell.value} value={shell.value}>
                                {shell.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          WSL requer o Windows Subsystem for Linux instalado
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Tamanho da Fonte: {settings.terminalFontSize}px</Label>
                        <Slider
                          value={[settings.terminalFontSize]}
                          onValueChange={([v]) => settings.setTerminalFontSize(v)}
                          min={10}
                          max={24}
                          step={1}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Git */}
              {activeTab === 'git' && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Configurações Git</h3>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="git-name">Nome do Usuário</Label>
                        <Input
                          id="git-name"
                          value={gitName}
                          onChange={(e) => setGitName(e.target.value)}
                          placeholder="Seu Nome"
                        />
                        <p className="text-xs text-muted-foreground">
                          Usado nos commits (git config user.name)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="git-email">Email</Label>
                        <Input
                          id="git-email"
                          type="email"
                          value={gitEmail}
                          onChange={(e) => setGitEmail(e.target.value)}
                          placeholder="seu@email.com"
                        />
                        <p className="text-xs text-muted-foreground">
                          Usado nos commits (git config user.email)
                        </p>
                      </div>

                      <Button onClick={handleSaveGitConfig}>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Configurações Git
                      </Button>

                      <Separator />

                      <div className="space-y-2">
                        <Label>Auto Fetch: {settings.autoFetchInterval === 0 ? 'Desativado' : `${settings.autoFetchInterval} min`}</Label>
                        <Slider
                          value={[settings.autoFetchInterval]}
                          onValueChange={([v]) => settings.setAutoFetchInterval(v)}
                          min={0}
                          max={30}
                          step={5}
                        />
                        <p className="text-xs text-muted-foreground">
                          Buscar atualizações automaticamente (0 = desativado)
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Behavior */}
              {activeTab === 'behavior' && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Comportamento</h3>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Tela Inicial</Label>
                        <Select
                          value={settings.defaultView}
                          onValueChange={(v) => settings.setDefaultView(v as DefaultView)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VIEW_OPTIONS.map((view) => (
                              <SelectItem key={view.value} value={view.value}>
                                {view.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Tela exibida ao abrir um repositório
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Confirmar Antes de Descartar</Label>
                          <p className="text-xs text-muted-foreground">
                            Pedir confirmação ao descartar alterações
                          </p>
                        </div>
                        <Switch
                          checked={settings.confirmBeforeDiscard}
                          onCheckedChange={settings.setConfirmBeforeDiscard}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Mostrar Arquivos Ocultos</Label>
                          <p className="text-xs text-muted-foreground">
                            Exibir arquivos que começam com ponto
                          </p>
                        </div>
                        <Switch
                          checked={settings.showHiddenFiles}
                          onCheckedChange={settings.setShowHiddenFiles}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* About */}
              {activeTab === 'about' && (
                <>
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Sobre o Git GUI</h3>

                    <div className="space-y-6">
                      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                        <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                          <GitBranch className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">Git GUI</h4>
                          <p className="text-sm text-muted-foreground">
                            Versão {appVersion}
                          </p>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="font-medium">Atualizações</h4>

                        {updateError && (
                          <div className="flex items-center gap-2 text-sm text-destructive">
                            <XCircle className="w-4 h-4" />
                            {updateError}
                          </div>
                        )}

                        {updateAvailable && update && (
                          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                            <CheckCircle className="w-4 h-4" />
                            Nova versão disponível: {update.version}
                          </div>
                        )}

                        {!updateAvailable && !updateError && !updateChecking && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            Você está usando a versão mais recente.
                          </div>
                        )}

                        <Button
                          variant="outline"
                          onClick={() => {
                            checkForUpdate().then((update) => {
                              if (update) {
                                onOpenChange(false); // Fechar settings
                                onOpenUpdateDialog?.(); // Abrir modal de atualização
                              } else {
                                toast({
                                  title: 'Sem atualizações',
                                  description: 'Você já está na versão mais recente.',
                                });
                              }
                            });
                          }}
                          disabled={updateChecking}
                        >
                          {updateChecking ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          {updateChecking ? 'Verificando...' : 'Verificar Atualizações'}
                        </Button>
                      </div>

                      <Separator />

                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Desenvolvido com Tauri + React</p>
                        <p>
                          <a
                            href="https://github.com/pcarvalho-dev/git-gui"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            github.com/pcarvalho-dev/git-gui
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
