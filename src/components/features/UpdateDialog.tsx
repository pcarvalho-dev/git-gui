import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, RefreshCw, X } from 'lucide-react';
import type { Update } from '@tauri-apps/plugin-updater';

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  update: Update | null;
  downloading: boolean;
  installing: boolean;
  canAutoUpdate: boolean;
  onDownload: () => void;
  onDownloadDeb: () => void;
  onDismiss: () => void;
}

export default function UpdateDialog({
  open,
  onOpenChange,
  update,
  downloading,
  installing,
  canAutoUpdate,
  onDownload,
  onDownloadDeb,
  onDismiss,
}: UpdateDialogProps) {
  if (!update) return null;

  const busy = downloading || installing;

  const statusLabel = installing
    ? 'Instalando... (autentique no diálogo do sistema)'
    : downloading
    ? 'Baixando atualização...'
    : null;

  return (
    <Dialog open={open} onOpenChange={busy ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Nova Atualização Disponível
          </DialogTitle>
          <DialogDescription>
            Versão <span className="font-semibold text-primary">{update.version}</span> disponível.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {update.body && (
            <div className="text-sm bg-muted p-3 rounded-md max-h-32 overflow-y-auto whitespace-pre-wrap">
              {update.body}
            </div>
          )}

          {statusLabel && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {statusLabel}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onDismiss} disabled={busy}>
            <X className="w-4 h-4 mr-2" />
            Depois
          </Button>
          <Button onClick={canAutoUpdate ? onDownload : onDownloadDeb} disabled={busy}>
            {busy ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {busy ? (installing ? 'Instalando...' : 'Baixando...') : 'Atualizar Agora'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
