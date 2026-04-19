import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import type { Update } from '@tauri-apps/plugin-updater';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  update: Update | null;
  downloading: boolean;
  canAutoUpdate: boolean;
  onDownload: () => void;
  onOpenReleases: () => void;
  onDismiss: () => void;
}

export default function UpdateDialog({
  open,
  onOpenChange,
  update,
  downloading,
  canAutoUpdate,
  onDownload,
  onOpenReleases,
  onDismiss,
}: UpdateDialogProps) {
  if (!update) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Nova Atualização Disponível
          </DialogTitle>
          <DialogDescription>
            {canAutoUpdate
              ? 'Uma nova versão do GitArc está disponível para download.'
              : 'Uma nova versão do GitArc está disponível. Baixe o instalador mais recente para atualizar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Nova versão:</span>
            <span className="font-semibold text-primary">{update.version}</span>
          </div>

          {update.body && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Novidades:</span>
              <div className="text-sm bg-muted p-3 rounded-md max-h-32 overflow-y-auto whitespace-pre-wrap">
                {update.body}
              </div>
            </div>
          )}

          {!canAutoUpdate && (
            <p className="text-xs text-muted-foreground">
              A atualização automática requer a versão AppImage. Instale o .AppImage para habilitar atualizações automáticas no futuro.
            </p>
          )}

          {downloading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Baixando atualização...
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onDismiss}
            disabled={downloading}
          >
            <X className="w-4 h-4 mr-2" />
            Depois
          </Button>
          {canAutoUpdate ? (
            <Button onClick={onDownload} disabled={downloading}>
              {downloading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              {downloading ? 'Baixando...' : 'Atualizar Agora'}
            </Button>
          ) : (
            <Button onClick={onOpenReleases}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir Página de Releases
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
