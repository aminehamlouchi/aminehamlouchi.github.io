const yearTarget = document.querySelector("[data-year]");
if (yearTarget) {
  yearTarget.textContent = new Date().getFullYear();
}

if (window.lucide) {
  window.lucide.createIcons();
}

const header = document.querySelector("[data-header]");
const setHeaderState = () => {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 8);
};

setHeaderState();
window.addEventListener("scroll", setHeaderState, { passive: true });

const canvas = document.querySelector("[data-motion-field]");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (canvas && !prefersReducedMotion) {
  const context = canvas.getContext("2d");
  const palette = ["#f2553d", "#00a67e", "#234ce8", "#e5c100", "#141414"];
  let width = 0;
  let height = 0;
  let dots = [];
  let pointer = { x: 0, y: 0, active: false };

  const resize = () => {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.offsetWidth;
    height = canvas.offsetHeight;
    canvas.width = Math.max(1, Math.floor(width * scale));
    canvas.height = Math.max(1, Math.floor(height * scale));
    context.setTransform(scale, 0, 0, scale, 0, 0);

    const count = Math.max(28, Math.min(82, Math.floor((width * height) / 18000)));
    dots = Array.from({ length: count }, (_, index) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.38,
      vy: (Math.random() - 0.5) * 0.38,
      radius: 2 + Math.random() * 3.6,
      color: palette[index % palette.length]
    }));
  };

  const draw = () => {
    context.clearRect(0, 0, width, height);

    for (const dot of dots) {
      dot.x += dot.vx;
      dot.y += dot.vy;

      if (dot.x < -20) dot.x = width + 20;
      if (dot.x > width + 20) dot.x = -20;
      if (dot.y < -20) dot.y = height + 20;
      if (dot.y > height + 20) dot.y = -20;

      if (pointer.active) {
        const dx = dot.x - pointer.x;
        const dy = dot.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 150 && distance > 0) {
          const push = (150 - distance) / 150;
          dot.x += (dx / distance) * push * 1.25;
          dot.y += (dy / distance) * push * 1.25;
        }
      }
    }

    for (let i = 0; i < dots.length; i += 1) {
      for (let j = i + 1; j < dots.length; j += 1) {
        const first = dots[i];
        const second = dots[j];
        const distance = Math.hypot(first.x - second.x, first.y - second.y);
        if (distance < 148) {
          const alpha = 1 - distance / 148;
          context.strokeStyle = `rgba(20, 20, 20, ${alpha * 0.15})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(first.x, first.y);
          context.lineTo(second.x, second.y);
          context.stroke();
        }
      }
    }

    for (const dot of dots) {
      context.fillStyle = dot.color;
      context.beginPath();
      context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
      context.fill();
    }

    requestAnimationFrame(draw);
  };

  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      active: true
    };
  });

  canvas.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  window.addEventListener("resize", resize, { passive: true });
  resize();
  draw();
}
