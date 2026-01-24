import type { RecentRepo } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FolderOpen, GitBranch, Clock, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WelcomeScreenProps {
  recentRepos: RecentRepo[];
  isLoading: boolean;
  onOpenRepo: () => void;
  onOpenRecent: (path: string) => void;
  onRemoveRecent: (path: string) => void;
}

export default function WelcomeScreen({
  recentRepos,
  isLoading,
  onOpenRepo,
  onOpenRecent,
  onRemoveRecent,
}: WelcomeScreenProps) {
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Hoje';
    if (days === 1) return 'Ontem';
    if (days < 7) return `${days} dias atrás`;
    if (days < 30) return `${Math.floor(days / 7)} semanas atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <motion.div
        className="w-full max-w-2xl p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="text-center space-y-4 mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <GitBranch className="w-16 h-16 mx-auto text-primary" />
          </motion.div>
          <h1 className="text-3xl font-bold">Git GUI</h1>
          <p className="text-muted-foreground">
            Gerencie seus repositórios Git de forma visual
          </p>
          <Button onClick={onOpenRepo} size="lg" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FolderOpen className="w-4 h-4 mr-2" />
            )}
            Abrir Repositório
          </Button>
        </div>

        {/* Recent Repos */}
        <AnimatePresence>
          {recentRepos.length > 0 && (
            <motion.div
              className="mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Repositórios Recentes</h2>
              </div>
              <ScrollArea className="h-80">
                <div className="space-y-2 pr-4">
                  {recentRepos.map((repo, index) => (
                    <motion.div
                      key={repo.path}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted cursor-pointer transition-colors group"
                      onClick={() => onOpenRecent(repo.path)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FolderOpen className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{repo.name}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {repo.path}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(repo.last_opened)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveRecent(repo.path);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!isLoading && recentRepos.length === 0 && (
          <motion.div
            className="text-center text-muted-foreground mt-8 p-8 border border-dashed border-border rounded-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <p>Nenhum repositório recente</p>
            <p className="text-sm mt-1">
              Os repositórios abertos aparecerão aqui
            </p>
          </motion.div>
        )}

        {/* Keyboard Shortcuts */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Ctrl+1-6</kbd>
            <span>Navegar</span>
          </span>
          <span className="mx-2">•</span>
          <span className="inline-flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Ctrl+R</kbd>
            <span>Atualizar</span>
          </span>
        </div>
      </motion.div>
    </div>
  );
}
