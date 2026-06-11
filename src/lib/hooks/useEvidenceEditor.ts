import { writable } from 'svelte/store';
import type { Evidence } from '@/types';
import { generateId } from '@/lib/utils';
import { cleanupEvidences } from '@/lib/utils/validation';

export interface UseEvidenceEditorOptions {
  initialEvidences?: Evidence[];
}

export interface UseEvidenceEditorReturn {
  evidences: typeof evidences;
  addEvidence: () => void;
  removeEvidence: (id: string) => void;
  updateEvidence: (id: string, field: keyof Evidence, value: string) => void;
  setEvidences: (evidences: Evidence[]) => void;
  reset: () => void;
  getCleanedEvidences: () => Evidence[];
}

export function useEvidenceEditor(
  options: UseEvidenceEditorOptions = {}
): UseEvidenceEditorReturn {
  const { initialEvidences = [] } = options;

  const evidences = writable<Evidence[]>(
    initialEvidences.map((e) => ({ ...e }))
  );

  function addEvidence() {
    evidences.update((prev) => [
      ...prev,
      { id: generateId(), source: '', pageOrCallNumber: '', description: '' },
    ]);
  }

  function removeEvidence(id: string) {
    evidences.update((prev) => prev.filter((e) => e.id !== id));
  }

  function updateEvidence(id: string, field: keyof Evidence, value: string) {
    evidences.update((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  }

  function setEvidences(newEvidences: Evidence[]) {
    evidences.set(newEvidences.map((e) => ({ ...e })));
  }

  function reset() {
    evidences.set([]);
  }

  function getCleanedEvidences(): Evidence[] {
    let result: Evidence[] = [];
    const unsubscribe = evidences.subscribe((v) => {
      result = cleanupEvidences(v);
    });
    unsubscribe();
    return result;
  }

  return {
    evidences,
    addEvidence,
    removeEvidence,
    updateEvidence,
    setEvidences,
    reset,
    getCleanedEvidences,
  };
}
