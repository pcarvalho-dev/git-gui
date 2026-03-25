import { describe, it, expect } from 'vitest';
import { getErrorMessage } from '@/lib/error';

describe('getErrorMessage', () => {
  it('retorna string diretamente quando o erro é string', () => {
    expect(getErrorMessage('algo deu errado')).toBe('algo deu errado');
  });

  it('retorna message quando o erro é instância de Error', () => {
    expect(getErrorMessage(new Error('erro nativo'))).toBe('erro nativo');
  });

  it('retorna message + details quando objeto tem ambos', () => {
    const err = { message: 'Branch não encontrada', details: 'main' };
    expect(getErrorMessage(err)).toBe('Branch não encontrada - main');
  });

  it('retorna apenas message quando objeto não tem details', () => {
    const err = { message: 'Repositório inválido' };
    expect(getErrorMessage(err)).toBe('Repositório inválido');
  });

  it('retorna JSON stringificado para objeto sem message', () => {
    const err = { code: 'ERR_001', foo: 'bar' };
    expect(getErrorMessage(err)).toBe(JSON.stringify(err));
  });

  it('retorna "Erro desconhecido" para null', () => {
    expect(getErrorMessage(null)).toBe('Erro desconhecido');
  });

  it('retorna "Erro desconhecido" para undefined', () => {
    expect(getErrorMessage(undefined)).toBe('Erro desconhecido');
  });

  it('retorna "Erro desconhecido" para número', () => {
    expect(getErrorMessage(42)).toBe('Erro desconhecido');
  });

  it('concatena details como string mesmo quando details é número', () => {
    const err = { message: 'Timeout', details: 500 };
    expect(getErrorMessage(err)).toBe('Timeout - 500');
  });
});
