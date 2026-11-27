import { DayData } from './db-service';
import { getBaseShift, QUARTERS, ShiftType } from './scale-utils';

export const MARKER_LABELS: Record<string, string> = {
  ATESTADO: 'Atestado',
  FERIAS: 'Férias',
  FOLGA: 'Folga (chamada)',
  LICENCA_PREMIUM: 'Licença premium',
  PERMUTA: 'Permuta',
};

export const MARKER_SHORT: Record<string, string> = {
  ATESTADO: 'ATEST',
  FERIAS: 'FÉRIAS',
  FOLGA: 'FOLGA',
  LICENCA_PREMIUM: 'LIC.PREM',
  PERMUTA: 'PERMUTA',
};

export const MERGE_FORMAT = 'sentinela-merge-v1';

export interface MergeDay {
  type?: ShiftType;
  quarters?: string[];
  observation?: string;
  markers?: string[];
  swapWith?: string;
}

export interface MergePayload {
  formato: typeof MERGE_FORMAT;
  dias: Record<string, MergeDay>;
}

export interface MergeStats {
  novos: number;
  atualizados: number;
  inalterados: number;
  ignorados: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const QUARTER_IDS = new Set(QUARTERS.map(q => q.id));
const SHIFT_TYPES = new Set<string>([
  'ORDINARIO', 'EXTRA_DIURNA', 'EXTRA_NOTURNA', 'PASSAR_PLANTAO', 'ASSUMIR_PLANTAO', 'FOLGA',
]);

/** Valida o JSON de importação. Lança Error com mensagem em português se for inválido. */
export function parseMergePayload(text: string): MergePayload {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Arquivo não é um JSON válido.');
  }
  const obj = raw as Partial<MergePayload> | null;
  if (!obj || obj.formato !== MERGE_FORMAT || typeof obj.dias !== 'object' || obj.dias === null) {
    throw new Error('Arquivo não está no formato de importação do Sentinela (sentinela-merge-v1).');
  }
  return obj as MergePayload;
}

function toDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isValidDate(key: string): boolean {
  if (!DATE_RE.test(key)) return false;
  const d = toDate(key);
  const [y, m, day] = key.split('-').map(Number);
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day;
}

function mergeLines(existing: string | undefined, incoming: string | undefined): string {
  const base = (existing ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  const add = (incoming ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of add) if (!base.includes(line)) base.push(line);
  return base.join('\n');
}

function union<T>(a: T[] = [], b: T[] = []): T[] {
  return [...a, ...b.filter(x => !a.includes(x))];
}

/**
 * Soma os lançamentos ao calendário atual SEM apagar nada:
 * - nunca troca o tipo de um dia que já existe;
 * - quartos e marcadores são unidos;
 * - observação ganha apenas as linhas que ainda não existem;
 * - ocorrências e permuta existentes ficam intactas.
 * Importar o mesmo arquivo duas vezes não duplica nada.
 */
export function mergeDayData(
  current: Record<string, DayData>,
  payload: MergePayload,
  baseDate: Date,
  scaleCycle: number
): { merged: Record<string, DayData>; stats: MergeStats } {
  const merged: Record<string, DayData> = { ...current };
  const stats: MergeStats = { novos: 0, atualizados: 0, inalterados: 0, ignorados: [] };

  for (const [key, day] of Object.entries(payload.dias)) {
    if (!isValidDate(key) || typeof day !== 'object' || day === null) {
      stats.ignorados.push(key);
      continue;
    }
    const quarters = (day.quarters ?? []).filter(q => QUARTER_IDS.has(q));
    const markers = (day.markers ?? []).filter(m => typeof m === 'string' && m.length > 0);
    const observation = typeof day.observation === 'string' ? day.observation : undefined;
    const prev = current[key];

    if (!prev) {
      const type: ShiftType =
        day.type && SHIFT_TYPES.has(day.type) ? day.type : getBaseShift(toDate(key), baseDate, scaleCycle);
      merged[key] = {
        type,
        quarters,
        ...(observation ? { observation: mergeLines('', observation) } : {}),
        ...(markers.length ? { markers } : {}),
        ...(day.swapWith ? { swapWith: day.swapWith } : {}),
      };
      stats.novos++;
      continue;
    }

    const next: DayData = {
      ...prev,
      quarters: union(prev.quarters, quarters),
      markers: union(prev.markers, markers),
    };
    const obs = mergeLines(prev.observation, observation);
    if (obs) next.observation = obs;
    if (!prev.swapWith && day.swapWith) next.swapWith = day.swapWith;
    if (!next.markers?.length) delete next.markers;

    const changed =
      next.quarters.length !== (prev.quarters ?? []).length ||
      (next.markers?.length ?? 0) !== (prev.markers?.length ?? 0) ||
      (next.observation ?? '') !== (prev.observation ?? '') ||
      next.swapWith !== prev.swapWith;
    if (changed) {
      merged[key] = next;
      stats.atualizados++;
    } else {
      stats.inalterados++;
    }
  }
  return { merged, stats };
}
