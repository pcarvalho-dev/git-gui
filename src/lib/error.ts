/**
 * Extrai a mensagem de erro de qualquer tipo de erro (Tauri, Error, string, etc.)
 */
export function getErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    const e = err as Record<string, unknown>;
    if (e.message) {
      const msg = String(e.message);
      const details = e.details ? ` - ${e.details}` : '';
      return msg + details;
    }
    return JSON.stringify(err);
  }
  return 'Erro desconhecido';
}
