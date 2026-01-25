import { useState, useEffect, useRef, useCallback } from 'react';
import { git } from '@/services/git';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/useGit';
import {
  Loader2,
  X,
  Save,
  FileCode,
  Undo2,
  Redo2,
} from 'lucide-react';

interface CodeEditorProps {
  filePath: string | null;
  onClose: () => void;
}

export default function CodeEditor({ filePath, onClose }: CodeEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const hasChanges = content !== originalContent;
  const lineCount = content.split('\n').length;

  // Load file
  useEffect(() => {
    if (!filePath) return;

    const loadFile = async () => {
      setLoading(true);
      try {
        const fileContent = await git.repo.readFile(filePath);
        setContent(fileContent);
        setOriginalContent(fileContent);
        setHistory([fileContent]);
        setHistoryIndex(0);
      } catch (err) {
        toast({
          title: 'Erro',
          description: err instanceof Error ? err.message : 'Falha ao carregar arquivo',
          variant: 'destructive',
        });
        onClose();
      } finally {
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath, toast, onClose]);

  // Sync scroll between textarea and line numbers
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // Handle content change with history
  const handleChange = useCallback((newContent: string) => {
    setContent(newContent);

    // Add to history (debounced)
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newContent);
    if (newHistory.length > 100) newHistory.shift(); // Limit history
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setContent(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setContent(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  // Save file
  const handleSave = useCallback(async () => {
    if (!filePath || !hasChanges) return;

    setSaving(true);
    try {
      await git.repo.writeFile(filePath, content);
      setOriginalContent(content);
      toast({ title: 'Salvo', description: `${filePath} foi salvo com sucesso` });
      queryClient.invalidateQueries({ queryKey: queryKeys.repoStatus });
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Falha ao salvar arquivo',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [filePath, content, hasChanges, toast, queryClient]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 's') {
          e.preventDefault();
          handleSave();
        } else if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleUndo, handleRedo]);

  // Handle tab key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      handleChange(newContent);

      // Set cursor position after tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  // Close with confirmation if there are unsaved changes
  const handleClose = () => {
    if (hasChanges) {
      if (confirm('Existem alteracoes nao salvas. Deseja fechar mesmo assim?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Get file extension for display
  const getFileExtension = (path: string) => {
    const parts = path.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'TXT';
  };

  if (!filePath) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border shrink-0 bg-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button size="sm" variant="ghost" onClick={handleClose} className="gap-1">
            <X className="w-4 h-4" />
            Fechar
          </Button>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-primary" />
            <span className="font-mono text-sm">{filePath}</span>
            {hasChanges && (
              <span className="w-2 h-2 rounded-full bg-yellow-500" title="Alteracoes nao salvas" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {getFileExtension(filePath)}
          </span>
          <span className="text-xs text-muted-foreground">
            {lineCount} linhas
          </span>
          <div className="h-6 w-px bg-border mx-1" />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Desfazer (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Refazer (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
          <div className="h-6 w-px bg-border mx-1" />
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="gap-1"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar
            <span className="text-xs opacity-70 ml-1">Ctrl+S</span>
          </Button>
        </div>
      </div>

      {/* Editor */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Line numbers */}
          <div
            ref={lineNumbersRef}
            className="w-12 bg-muted/50 border-r border-border overflow-hidden select-none"
          >
            <div className="py-2">
              {Array.from({ length: lineCount }, (_, i) => (
                <div
                  key={i}
                  className="px-2 text-right text-xs text-muted-foreground font-mono leading-6"
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            className="flex-1 p-2 bg-background text-sm font-mono leading-6 resize-none outline-none overflow-auto"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Linha {textareaRef.current?.value.substring(0, textareaRef.current?.selectionStart).split('\n').length || 1}</span>
          <span>UTF-8</span>
        </div>
        <div className="flex items-center gap-4">
          {hasChanges && <span className="text-yellow-500">Modificado</span>}
          <span>Espacos: 2</span>
        </div>
      </div>
    </div>
  );
}
