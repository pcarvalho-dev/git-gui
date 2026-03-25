import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('combina classes simples', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('ignora valores falsy (undefined, null, false)', () => {
    expect(cn('foo', undefined, null, false, 'bar')).toBe('foo bar');
  });

  it('resolve conflitos Tailwind mantendo a última classe', () => {
    // tailwind-merge prioriza a última declaração
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  it('aceita objeto condicional do clsx', () => {
    expect(cn({ 'font-bold': true, 'text-red-500': false })).toBe('font-bold');
  });

  it('aceita array de classes', () => {
    expect(cn(['flex', 'items-center'])).toBe('flex items-center');
  });

  it('retorna string vazia quando não há classes', () => {
    expect(cn()).toBe('');
  });

  it('combina classes condicionais com classes fixas', () => {
    const isActive = true;
    const result = cn('btn', { 'btn-active': isActive, 'btn-disabled': false });
    expect(result).toBe('btn btn-active');
  });
});
