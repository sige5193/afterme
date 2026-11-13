import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastItem = {
  id: number;
  html: string;
  err?: boolean;
  btn?: string;
  onBtn?: () => void;
  ms: number;
};

export type ModalKind =
  | null
  | 'burn'
  | 'dreamComposer'
  | 'inbox'
  | 'dreams'
  | 'invite'
  | 'wealth'
  | 'epitaph'
  | 'zhashi'
  | 'resurrect'
  | 'resurrectCode';

let toastSeq = 1;

export const useUiStore = defineStore('ui', () => {
  const toasts = ref<ToastItem[]>([]);
  const modal = ref<ModalKind>(null);
  const modalPayload = ref<Record<string, unknown>>({});
  const burnOverlay = ref<{ items: Record<string, number>; name: string } | null>(null);
  const dreamOverlay = ref<{
    text: string;
    style: string;
    fromName: string;
    at: number;
    id: string | number;
  } | null>(null);
  const lidsClosing = ref(false);
  const sleepText = ref(false);
  const sound = ref(true);
  const flipped = ref(false);
  const pref = ref<'cemetery' | 'coffin'>('cemetery');
  const funeralOpen = ref(false);
  const funeralPrefill = ref<{ plot?: number }>({});
  const shakeStone = ref(false);
  const shakePlot = ref<number | null>(null);

  try {
    const s = localStorage.getItem('afterme:sound');
    if (s != null) sound.value = s !== '0' && s !== 'false';
  } catch {
    /* ignore */
  }

  function toast(
    html: string,
    opts: { btn?: string; onBtn?: () => void; err?: boolean; ms?: number } = {},
  ) {
    const id = toastSeq++;
    const ms = opts.ms ?? 4200;
    const item: ToastItem = {
      id,
      html,
      err: opts.err,
      btn: opts.btn,
      onBtn: opts.onBtn,
      ms: opts.btn ? ms + 3000 : ms,
    };
    toasts.value.push(item);
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, item.ms);
  }

  function openModal(kind: ModalKind, payload: Record<string, unknown> = {}) {
    modal.value = kind;
    modalPayload.value = payload;
  }

  function closeModal() {
    modal.value = null;
    modalPayload.value = {};
  }

  function setSound(v: boolean) {
    sound.value = v;
    try {
      localStorage.setItem('afterme:sound', v ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  function toggleSound() {
    setSound(!sound.value);
  }

  return {
    toasts,
    modal,
    modalPayload,
    burnOverlay,
    dreamOverlay,
    lidsClosing,
    sleepText,
    sound,
    flipped,
    pref,
    funeralOpen,
    funeralPrefill,
    shakeStone,
    shakePlot,
    toast,
    openModal,
    closeModal,
    setSound,
    toggleSound,
  };
});
