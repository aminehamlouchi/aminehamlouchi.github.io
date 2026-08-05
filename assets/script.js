/* ============================================================
   amine.sys — site engine
   Hand-written vanilla JS. GSAP + Lenis are self-hosted in
   assets/vendor (both free/MIT-licensed). Everything degrades:
   no JS, no motion preference, no WebGL — the content stays.
   ============================================================ */

(() => {
  "use strict";

  const motionOK = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined";

  /* ---------- basics ---------- */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  const header = document.querySelector("[data-header]");
  const setHeaderState = () => {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 10);
  };
  setHeaderState();
  window.addEventListener("scroll", setHeaderState, { passive: true });

  /* ---------- smooth scroll (Lenis) ---------- */
  let lenis = null;
  if (motionOK && typeof window.Lenis !== "undefined") {
    lenis = new window.Lenis({ lerp: 0.11 });
    if (hasGsap) {
      lenis.on("scroll", window.ScrollTrigger ? window.ScrollTrigger.update : () => {});
      window.gsap.ticker.add((time) => lenis.raf(time * 1000));
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }
  }

  // anchor links play nice with Lenis
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -60 });
      else target.scrollIntoView({ behavior: motionOK ? "smooth" : "auto" });
    });
  });

  /* ---------- GSAP reveals ---------- */
  if (hasGsap && motionOK && window.ScrollTrigger) {
    const { gsap } = window;
    gsap.registerPlugin(window.ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(window.SplitText);

    const EASE = "power4.out";

    document.fonts.ready.then(() => {
      // hero intro
      const heroName = document.querySelector("[data-hero-name]");
      if (heroName && window.SplitText) {
        const split = new window.SplitText(heroName.querySelectorAll(".row"), {
          type: "chars",
          mask: "chars",
        });
        const tl = gsap.timeline({ defaults: { ease: EASE } });
        tl.from("[data-hero-prompt]", { opacity: 0, y: 12, duration: 0.5 })
          .from(
            split.chars,
            { yPercent: 115, duration: 1.0, stagger: 0.028 },
            "-=0.2"
          )
          .from("[data-hero-sub]", { opacity: 0, y: 16, duration: 0.7 }, "-=0.55")
          .from("[data-hero-actions] .btn", { opacity: 0, y: 14, duration: 0.55, stagger: 0.08 }, "-=0.45")
          .from("[data-hero-data]", { opacity: 0, duration: 0.7 }, "-=0.3");
      }

      // generic reveals
      document.querySelectorAll("[data-reveal]").forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            duration: 0.95,
            ease: EASE,
            scrollTrigger: { trigger: el, start: "top 86%", once: true },
          }
        );
      });

      // grouped stagger reveals
      document.querySelectorAll("[data-reveal-group]").forEach((group) => {
        gsap.fromTo(
          group.children,
          { opacity: 0, y: 26 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: EASE,
            stagger: 0.07,
            scrollTrigger: { trigger: group, start: "top 85%", once: true },
          }
        );
      });
    });
  }

  /* ---------- custom cursor ---------- */
  if (finePointer && motionOK) {
    const dot = document.createElement("div");
    const ring = document.createElement("div");
    dot.className = "cursor-dot";
    ring.className = "cursor-ring";
    document.body.append(dot, ring);
    document.documentElement.classList.add("has-cursor");

    let mx = -100;
    let my = -100;
    let rx = -100;
    let ry = -100;

    window.addEventListener(
      "pointermove",
      (e) => {
        mx = e.clientX;
        my = e.clientY;
        dot.style.transform = `translate(${mx}px, ${my}px)`;
      },
      { passive: true }
    );

    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px, ${ry}px)`;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    const hoverables = "a, button, [data-magnetic], .ttt-cell, .checker-square";
    document.addEventListener("pointerover", (e) => {
      if (e.target.closest(hoverables)) ring.classList.add("is-hover");
    });
    document.addEventListener("pointerout", (e) => {
      if (e.target.closest(hoverables)) ring.classList.remove("is-hover");
    });
  }

  /* ---------- magnetic elements ---------- */
  if (finePointer && motionOK && hasGsap) {
    document.querySelectorAll("[data-magnetic]").forEach((el) => {
      const xTo = window.gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
      const yTo = window.gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });

      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      el.addEventListener("pointerleave", () => {
        xTo(0);
        yTo(0);
      });
    });
  }

  /* ---------- spotlight cards ---------- */
  document.querySelectorAll(".repo-card, .cartridge").forEach((card) => {
    card.addEventListener(
      "pointermove",
      (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      },
      { passive: true }
    );
  });

  /* ---------- scramble hover (brand) ---------- */
  const scrambleEl = document.querySelector("[data-scramble]");
  if (scrambleEl && motionOK) {
    const GLYPHS = "!<>-_\\/[]{}=+*^?#░▒▓";
    const original = scrambleEl.textContent;
    let frame = null;

    scrambleEl.closest("a").addEventListener("pointerenter", () => {
      let i = 0;
      clearInterval(frame);
      frame = setInterval(() => {
        scrambleEl.textContent = original
          .split("")
          .map((ch, idx) => {
            if (idx < i) return original[idx];
            if (ch === ".") return ".";
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join("");
        i += 1;
        if (i > original.length) {
          clearInterval(frame);
          scrambleEl.textContent = original;
        }
      }, 28);
    });
  }

  /* ============================================================
     PARTICLE FIELD — أمين ⇄ AMINE
     ============================================================ */
  const canvas = document.querySelector("[data-particles]");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const WORDS = ["أمين", "AMINE"];
    const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    const MAX_POINTS = window.innerWidth < 700 ? 900 : 2100;

    let particles = [];
    let width = 0;
    let height = 0;
    let wordIndex = 0;
    let running = false;
    let rafId = null;
    let morphTimer = null;
    const pointer = { x: -9999, y: -9999 };

    const cssSize = () => {
      const r = canvas.getBoundingClientRect();
      width = r.width;
      height = r.height;
      canvas.width = Math.max(1, Math.floor(width * DPR));
      canvas.height = Math.max(1, Math.floor(height * DPR));
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    const sampleWord = (word) => {
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.floor(width));
      off.height = Math.max(1, Math.floor(height));
      const octx = off.getContext("2d", { willReadFrequently: true });

      const isArabic = /[؀-ۿ]/.test(word);
      const family = isArabic ? '"Reem Kufi"' : '"Clash Display"';
      const narrow = width < 700;
      // when the 3D bust owns the right side, the word shrinks and floats upper-center
      const bustOn = !narrow && !!document.querySelector("[data-bust]");
      let fontSize =
        Math.min(height * (isArabic ? 0.5 : 0.34), width * (isArabic ? 0.3 : 0.24)) * (bustOn ? 0.62 : 1);
      const cx = narrow ? width * 0.5 : bustOn ? width * 0.42 : width * 0.66;
      const cy = narrow ? height * 0.34 : bustOn ? height * 0.26 : height * 0.42;

      octx.fillStyle = "#fff";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.font = `700 ${Math.floor(fontSize)}px ${family}, sans-serif`;
      // keep the word inside the canvas (no edge clipping)
      const maxW = narrow ? width * 0.9 : bustOn ? width * 0.34 : width * 0.58;
      const tw = octx.measureText(word).width;
      if (tw > maxW) {
        fontSize *= maxW / tw;
        octx.font = `700 ${Math.floor(fontSize)}px ${family}, sans-serif`;
      }
      octx.fillText(word, cx, cy);

      const data = octx.getImageData(0, 0, off.width, off.height).data;
      let gap = 4;
      const collect = (g) => {
        const arr = [];
        for (let y = 0; y < off.height; y += g) {
          for (let x = 0; x < off.width; x += g) {
            if (data[(y * off.width + x) * 4 + 3] > 128) arr.push({ x, y });
          }
        }
        return arr;
      };
      let pts = collect(gap);
      while (pts.length > MAX_POINTS && gap < 12) {
        gap += 1;
        pts = collect(gap);
      }
      return pts;
    };

    const COLORS = ["#ffb000", "#ffb000", "#ffb000", "#e8a33d", "#ede4d3"];

    const assignTargets = (pts) => {
      for (let i = pts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pts[i], pts[j]] = [pts[j], pts[i]];
      }
      const n = Math.max(pts.length, particles.length);
      for (let i = 0; i < n; i++) {
        if (!particles[i]) {
          particles[i] = {
            x: Math.random() * width,
            y: Math.random() * height,
            vx: 0,
            vy: 0,
            size: Math.random() < 0.85 ? 1.6 : 2.4,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            alpha: 0.55 + Math.random() * 0.45,
          };
        }
        const p = particles[i];
        if (pts[i]) {
          p.tx = pts[i].x;
          p.ty = pts[i].y;
          p.dust = false;
        } else {
          p.tx = Math.random() * width;
          p.ty = Math.random() * height;
          p.dust = true;
        }
      }
      particles.length = n;
    };

    const step = () => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        const k = p.dust ? 0.002 : 0.055;
        p.vx += (p.tx - p.x) * k;
        p.vy += (p.ty - p.y) * k;

        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        const R = 110;
        if (d2 < R * R && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = ((R - d) / R) * 2.2;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }

        p.vx *= 0.86;
        p.vy *= 0.86;
        p.x += p.vx;
        p.y += p.vy;

        ctx.globalAlpha = p.dust ? p.alpha * 0.25 : p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(step);
    };

    const start = () => {
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(step);
      }
    };
    const stop = () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    };

    const morph = () => {
      wordIndex = (wordIndex + 1) % WORDS.length;
      assignTargets(sampleWord(WORDS[wordIndex]));
    };

    const boot = () => {
      cssSize();
      assignTargets(sampleWord(WORDS[wordIndex]));
      if (motionOK) {
        start();
        morphTimer = setInterval(morph, 7000);
      } else {
        for (const p of particles) {
          p.x = p.tx;
          p.y = p.ty;
        }
        ctx.clearRect(0, 0, width, height);
        for (const p of particles) {
          if (p.dust) continue;
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.globalAlpha = 1;
      }
    };

    canvas.parentElement.addEventListener(
      "pointermove",
      (e) => {
        const r = canvas.getBoundingClientRect();
        pointer.x = e.clientX - r.left;
        pointer.y = e.clientY - r.top;
      },
      { passive: true }
    );
    canvas.parentElement.addEventListener("pointerleave", () => {
      pointer.x = -9999;
      pointer.y = -9999;
    });
    canvas.addEventListener("click", () => {
      if (motionOK) morph();
    });

    if (motionOK) {
      const io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) start();
          else stop();
        },
        { threshold: 0.02 }
      );
      io.observe(canvas);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) stop();
        else if (morphTimer !== null) start();
      });
    }

    let resizeT = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => {
        cssSize();
        assignTargets(sampleWord(WORDS[wordIndex]));
      }, 200);
    });

    const fontsNeeded = [
      document.fonts.load('700 100px "Reem Kufi"', "أمين"),
      document.fonts.load('700 100px "Clash Display"', "AMINE"),
    ];
    Promise.race([Promise.all(fontsNeeded), new Promise((res) => setTimeout(res, 1600))]).then(boot);
  }

  /* ============================================================
     TERMINAL OVERLAY
     ============================================================ */
  const term = document.querySelector("[data-terminal]");
  if (term) {
    const scroll = term.querySelector("[data-term-scroll]");
    const input = term.querySelector("[data-term-input]");
    const history = [];
    let historyIdx = -1;

    const print = (html, cls = "line-out") => {
      const p = document.createElement("p");
      p.className = cls;
      p.innerHTML = html;
      scroll.appendChild(p);
      scroll.scrollTop = scroll.scrollHeight;
    };

    const printCmd = (cmd) => {
      print(`<span class="user">amine@louisville:~$</span> ${cmd.replace(/</g, "&lt;")}`, "line-cmd");
    };

    const LINK = (href, label) => `<a href="${href}" target="_blank" rel="noreferrer">${label || href}</a>`;

    const COMMANDS = {
      help: () =>
        [
          "available commands:",
          "  whoami      — who is this guy",
          "  work        — featured systems",
          "  repos       — public code",
          "  arcade      — playable games",
          "  skills      — the toolbox",
          "  edu         — education",
          "  resume      — the pdf",
          "  contact     — reach me",
          "  arabic      — لماذا العربية؟",
          "  sudo hire-me",
          "  clear · exit",
        ].join("\n"),
      whoami: () =>
        "Amine Hamlouchi — CS student @ University of Louisville (Speed School).\nBuilds AI pipelines with verification built in, full-stack platforms\nwith real users, and IT automation. Minor in Arabic. Louisville, KY.",
      work: () =>
        "→ Argument Knowledge Base — 731 arguments, 1,100+ citations, all verified\n→ School Operations Platform — bilingual EN/AR, 80 users, 106 API routes\n→ Rumi — privacy-first roommate matching · " +
        LINK("https://findyourrumi.com", "findyourrumi.com"),
      repos: () => "public code lives at " + LINK("https://github.com/aminehamlouchi", "github.com/aminehamlouchi"),
      ls: () => "work/  repos/  arcade/  skills/  education/  contact/  resume.pdf",
      arcade: () =>
        'two cartridges loaded:\n→ <a href="checkers.html">checkers.html</a>\n→ <a href="tic-tac-toe-3d.html">tic-tac-toe-3d.html</a>',
      skills: () =>
        "languages : Python · Java · C · C++ · JS/TS · SQL · Bash\nai/ml     : RAG · LLM orchestration · NLP/IE · ETL · scikit-learn\nweb/sys   : React · Next.js · Node · PostgreSQL · Supabase · Docker",
      edu: () =>
        "University of Louisville — J.B. Speed School of Engineering\nB.A. Computer Science · Minor in Arabic · GPA 3.5/4.0 · exp. May 2028",
      resume: () =>
        "→ " +
        LINK("assets/amine-hamlouchi-resume.pdf", "amine-hamlouchi-resume.pdf") +
        '  (also: <a href="resume.html">resume.html</a>)',
      contact: () =>
        "email  : " +
        LINK("mailto:aahaml01@louisville.edu", "aahaml01@louisville.edu") +
        "\ngithub : " +
        LINK("https://github.com/aminehamlouchi", "github.com/aminehamlouchi"),
      arabic: () => ({
        text: "أهلاً وسهلاً! أدرس العربية كتخصص فرعي —\nولهذا يتكلم هذا الموقع لغتين.",
        cls: "line-out ar",
      }),
      salaam: () => ({ text: "وعليكم السلام ورحمة الله", cls: "line-out ar" }),
      sudo: (args) =>
        args.join(" ") === "hire-me"
          ? "[sudo] permission granted.\nforwarding to " +
            LINK("mailto:aahaml01@louisville.edu", "aahaml01@louisville.edu") +
            " ..."
          : "amine is not in the sudoers file. this incident will be reported.",
      rm: () => "nice try.",
      clear: () => {
        scroll.innerHTML = "";
        return null;
      },
      exit: () => {
        term.close();
        return null;
      },
    };
    COMMANDS.projects = COMMANDS.work;
    COMMANDS.games = COMMANDS.arcade;
    COMMANDS.email = COMMANDS.contact;
    COMMANDS.github = COMMANDS.repos;
    COMMANDS.cat = (args) => {
      const key = (args[0] || "").replace(/\/$/, "").replace(/^skills\//, "skills");
      const target = COMMANDS[key];
      return target ? target([]) : `cat: ${args[0] || ""}: no such file`;
    };

    const run = (raw) => {
      const line = raw.trim();
      if (!line) return;
      printCmd(line);
      history.push(line);
      historyIdx = history.length;
      const [cmd, ...args] = line.toLowerCase().split(/\s+/);
      const handler = COMMANDS[cmd];
      if (!handler) {
        print(`command not found: ${cmd.replace(/</g, "&lt;")} — try 'help'`);
        return;
      }
      const out = handler(args);
      if (out === null || out === undefined) return;
      if (typeof out === "object") print(out.text, out.cls);
      else print(out);
    };

    const openTerm = () => {
      if (term.open) return;
      term.showModal();
      if (!scroll.childElementCount) {
        print("amine.sys v2.0 — hand-built, zero frameworks");
        print("type 'help' to look around.");
      }
      input.focus();
    };

    document.querySelectorAll("[data-term-open]").forEach((b) => b.addEventListener("click", openTerm));
    const closeBtn = term.querySelector("[data-term-close]");
    if (closeBtn) closeBtn.addEventListener("click", () => term.close());

    window.addEventListener("keydown", (e) => {
      if (e.key === "/" && !term.open && !/input|textarea/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        openTerm();
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        run(input.value);
        input.value = "";
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (historyIdx > 0) input.value = history[(historyIdx -= 1)] || "";
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIdx < history.length) input.value = history[(historyIdx += 1)] || "";
      }
    });

    term.addEventListener("click", (e) => {
      if (e.target === term) term.close();
    });
  }
})();
