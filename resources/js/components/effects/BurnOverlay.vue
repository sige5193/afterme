<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { ITEM } from '@/config/items';
import { itemsText } from '@/stores/offerings';
import { REDUCED } from '@/utils/text';
import { useUiStore } from '@/stores/ui';

const props = defineProps<{ items: Record<string, number>; name: string }>();
const emit = defineEmits<{ done: [] }>();
const ui = useUiStore();
const canvas = ref<HTMLCanvasElement | null>(null);
const msg = ref('正在化纸……');
let raf = 0;
let done = false;

onMounted(() => {
  const cv = canvas.value!;
  const ctx = cv.getContext('2d')!;
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = innerWidth / 2;
  const cy = innerHeight * 0.64;
  let heat = 0.25;
  let parts: any[] = [];
  window.dispatchEvent(new CustomEvent('afterme:crackle', { detail: 3.6 }));

  const loop = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const n = Math.round(6 * heat + 1);
    for (let i = 0; i < n; i++)
      parts.push({
        x: cx + (Math.random() - 0.5) * 170 * Math.min(1, heat + 0.3),
        y: cy + 4,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -(1.4 + Math.random() * 2.6 * heat),
        life: 0,
        max: 30 + Math.random() * 40,
        r: 8 + Math.random() * 14 * heat,
        ember: Math.random() < 0.08,
      });
    ctx.globalCompositeOperation = 'lighter';
    parts = parts.filter((p) => p.life < p.max);
    for (const p of parts) {
      p.life++;
      p.x += p.vx + Math.sin((p.life + p.y) / 9) * 0.4;
      p.y += p.ember ? p.vy * 1.6 : p.vy;
      const k = p.life / p.max;
      if (p.ember) {
        ctx.fillStyle = `rgba(255,${200 - k * 120},80,${1 - k})`;
        ctx.fillRect(p.x, p.y, 2, 2);
        continue;
      }
      const r = p.r * (1 - k * 0.6);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, `rgba(255,${230 - k * 150},${120 - k * 100},${0.55 * (1 - k)})`);
      g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, 7);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    if (!done) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  const icons: string[] = [];
  Object.entries(props.items).forEach(([k, n]) => {
    for (let i = 0; i < Math.min(n, 3); i++) icons.push(ITEM[k]?.icon || '💴');
  });
  icons.splice(14);
  const ov = cv.parentElement!;
  icons.forEach((ic, i) => {
    const el = document.createElement('span');
    el.className = 'fall';
    el.textContent = ic;
    const sx = cx + (Math.random() - 0.5) * Math.min(innerWidth * 0.8, 600);
    el.style.left = sx - 19 + 'px';
    el.style.top = '-60px';
    ov.append(el);
    const dy = cy + 60;
    const dx = cx - sx + (Math.random() - 0.5) * 60;
    const a = el.animate(
      [
        { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
        {
          transform: `translate(${dx * 0.9}px,${dy * 0.8}px) rotate(${(Math.random() - 0.5) * 220}deg) scale(.95)`,
          opacity: 1,
          offset: 0.75,
        },
        {
          transform: `translate(${dx}px,${dy}px) rotate(${(Math.random() - 0.5) * 400}deg) scale(.2)`,
          opacity: 0,
        },
      ],
      {
        duration: REDUCED ? 10 : 1400,
        delay: REDUCED ? 0 : 200 + i * 170,
        easing: 'cubic-bezier(.45,0,.75,.6)',
        fill: 'forwards',
      },
    );
    a.onfinish = () => {
      heat = Math.min(1.25, heat + 0.14);
      el.remove();
    };
  });

  const total = REDUCED ? 900 : Math.max(3400, 200 + icons.length * 170 + 1800);
  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    ov.style.transition = 'opacity .5s';
    ov.style.opacity = '0';
    setTimeout(() => emit('done'), 500);
  };
  setTimeout(() => {
    msg.value = '已送达 · 阴间到账';
    (window as any).__aftermeJoss?.burst?.(40);
  }, total - 900);
  setTimeout(finish, total + 600);
  setTimeout(() => ov.addEventListener('click', finish), 1500);
});

onUnmounted(() => cancelAnimationFrame(raf));
</script>

<template>
  <div class="burn">
    <canvas ref="canvas" />
    <div class="basin" />
    <div class="burn-msg">{{ msg }}</div>
    <div class="burn-sub">给 {{ name }} · {{ itemsText(items) }}</div>
  </div>
</template>
