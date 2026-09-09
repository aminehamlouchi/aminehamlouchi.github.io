/* ============================================================
   script.js — aminehamlouchi.com
   Theme, header, smooth scroll, girih lattice, name reveal,
   scroll reveals, hover list, pointer-lit cards, copy button,
   terminal, easter eggs. Every module guards on its element,
   so the same file runs on the résumé and game pages.
   Libraries (GSAP, ScrollTrigger, SplitText, Lenis) are vendored
   and optional: the page reads fine if any of them is missing.
   ============================================================ */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const motionOK = window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined";
  const root = document.documentElement;

  /* ============================================================
     THEME
     ============================================================ */
  const themeEvent = () => window.dispatchEvent(new CustomEvent("amine:theme"));
  const currentTheme = () => {
    const t = root.getAttribute("data-theme");
    if (t) return t;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  };
  const setTheme = (t) => {
    root.setAttribute("data-theme", t);
    try {
      localStorage.setItem("theme", t);
    } catch {
      /* private mode */
    }
    themeEvent();
  };
  $$("[data-theme-toggle]").forEach((b) =>
    b.addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"))
  );

  /* ============================================================
     TOAST
     ============================================================ */
  const toastEl = $("[data-toast]");
  let toastT = 0;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("is-on"), 2200);
  };

  /* ============================================================
     HEADER + MOBILE NAV
     ============================================================ */
  const header = $("[data-header]");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
  const navToggle = $("[data-nav-toggle]");
  const nav = $("#main-nav");
  if (navToggle && nav) {
    const close = () => {
      nav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    };
    navToggle.addEventListener("click", () => {
      const open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      navToggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) close();
    });
    window.addEventListener("keydown", (e) => e.key === "Escape" && close());
  }

  /* ============================================================
     SMOOTH SCROLL (Lenis) — desktop, motion allowed
     ============================================================ */
  let lenis = null;
  if (motionOK && finePointer && typeof window.Lenis !== "undefined") {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    if (hasGsap) {
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (t) => {
        lenis.raf(t);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }
    $$('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        const target = id.length > 1 && $(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -72 });
        history.pushState(null, "", id);
      });
    });
  }

  /* ============================================================
     GIRIH LATTICE — ten-point stars on a canvas, glow under the pointer
     ============================================================ */
  const lattice = (() => {
    const canvas = $("[data-lattice]");
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    const hero = canvas.parentElement;
    const coarse = !finePointer;
    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.5);
    let w = 0;
    let h = 0;
    let px = -9999;
    let py = -9999;
    let rgb = "63,210,173";
    let running = false;
    let raf = 0;
    let storm = 0; // > now while the konami storm is on
    const t0 = performance.now();

    const readColor = () => {
      const v = getComputedStyle(root).getPropertyValue("--accent-rgb").trim();
      if (v) rgb = v.replace(/\s+/g, "");
    };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const star = (cx, cy, R, rot, alpha) => {
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const k = (i * 3) % 10;
        const a = rot + (k * Math.PI) / 5;
        const x = cx + R * Math.cos(a);
        const y = cy + R * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
      ctx.stroke();
    };
    const draw = (now) => {
      const el = (now - t0) / 1000;
      const stormy = now < storm;
      const speed = stormy ? 14 : 1;
      const rot = motionOK ? el * (Math.PI / 720) * speed : 0;
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      const R = coarse ? 42 : 56;
      const sx = R * 1.9;
      const sy = R * 1.65;
      const cols = Math.ceil(w / sx) + 2;
      const rows = Math.ceil(h / sy) + 2;
      for (let j = -1; j < rows; j++) {
        for (let i = -1; i < cols; i++) {
          const cx = i * sx + (j % 2 ? sx / 2 : 0);
          const cy = j * sy;
          const dx = cx - px;
          const dy = cy - py;
          const d = Math.sqrt(dx * dx + dy * dy);
          const glow = coarse ? 0 : Math.max(0, 1 - d / (stormy ? 520 : 240));
          const breathe = motionOK ? 0.05 * Math.sin(el * 0.6 + i * 0.7 + j * 0.9) : 0;
          const base = (stormy ? 0.22 : 0.12) + breathe;
          star(cx, cy, R, rot, base + glow * 0.55);
        }
      }
      if (motionOK && running) raf = requestAnimationFrame(draw);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(draw);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    readColor();
    resize();
    window.addEventListener("resize", () => {
      resize();
      if (!motionOK) draw(performance.now());
    });
    window.addEventListener("amine:theme", () => {
      readColor();
      if (!motionOK) draw(performance.now());
    });
    hero.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
    });
    hero.addEventListener("pointerleave", () => {
      px = py = -9999;
    });
    if (motionOK) {
      const io = new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop()));
      io.observe(canvas);
      document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    } else {
      draw(performance.now());
    }
    return {
      storm() {
        storm = performance.now() + 6000;
        if (!motionOK) draw(performance.now());
      },
      toggle() {
        const off = canvas.style.opacity === "0";
        canvas.style.opacity = off ? "" : "0";
        return !off;
      },
    };
  })();

  /* ============================================================
     HERO NAME — letters rise in, once
     ============================================================ */
  const nameRows = $$("[data-split]");
  if (nameRows.length && hasGsap && motionOK && typeof window.SplitText !== "undefined") {
    gsap.registerPlugin(SplitText);
    const chars = [];
    nameRows.forEach((row) => {
      const s = new SplitText(row, { type: "chars", charsClass: "char" });
      chars.push(...s.chars);
    });
    gsap.set(chars, { yPercent: 110, rotate: 4 });
    document.fonts.ready.then(() => {
      gsap.to(chars, {
        yPercent: 0,
        rotate: 0,
        duration: 1.1,
        ease: "expo.out",
        stagger: { each: 0.035, from: "start" },
        delay: 0.12,
      });
    });
  }

  /* ============================================================
     SCROLL REVEALS + COUNTERS
     ============================================================ */
  if (hasGsap && motionOK && typeof window.ScrollTrigger !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
    $$("[data-reveal]").forEach((el) => {
      gsap.from(el, {
        y: 26,
        opacity: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true },
      });
    });
    $$("[data-reveal-group]").forEach((group) => {
      const items = Array.from(group.children);
      gsap.from(items, {
        y: 22,
        opacity: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.06,
        scrollTrigger: { trigger: group, start: "top 85%", once: true },
      });
    });
    if (lenis) lenis.on("scroll", ScrollTrigger.update);
    // fonts change layout heights; re-measure once they are in
    document.fonts.ready.then(() => ScrollTrigger.refresh());
    // printing and "save as PDF" never scroll: show everything
    window.addEventListener("beforeprint", () => {
      gsap.set("[data-reveal], [data-reveal-group] > *", { clearProps: "all" });
    });
  }

  /* ============================================================
     WORK — hover list drives the preview; tap expands on phones
     ============================================================ */
  const rows = $$("[data-work-rows] .work-row");
  const preview = $("[data-work-preview]");
  if (rows.length) {
    const img = $("[data-preview-img]");
    const big = $("[data-preview-big]");
    const num = $("[data-preview-num]");
    const bigLabel = $("[data-preview-biglabel]");
    const title = $("[data-preview-title]");
    const desc = $("[data-preview-desc]");
    const stack = $("[data-preview-stack]");
    const status = $("[data-preview-status]");
    const link = $("[data-preview-link]");
    const receipt = $("[data-preview-receipt]");
    const isDesktop = () => window.matchMedia("(min-width: 901px)").matches;
    let current = null;

    const countTo = (target) => {
      if (!num) return;
      const n = Number(target);
      if (!hasGsap || !motionOK || Number.isNaN(n)) {
        num.textContent = target;
        return;
      }
      const o = { v: 0 };
      gsap.to(o, {
        v: n,
        duration: 0.9,
        ease: "power2.out",
        onUpdate: () => (num.textContent = Math.round(o.v).toLocaleString("en-US")),
      });
    };

    const show = (row) => {
      if (row === current) return;
      current = row;
      rows.forEach((r) => r.setAttribute("aria-current", String(r === row)));
      const d = row.dataset;
      if (title) title.textContent = d.title;
      if (desc) desc.textContent = d.desc;
      if (stack) stack.textContent = d.stack;
      if (status) status.textContent = d.status;
      if (receipt) receipt.textContent = d.receipt || "";
      if (link) {
        if (d.link) {
          link.href = d.link;
          link.textContent = d.linkLabel || d.link;
          link.hidden = false;
        } else {
          link.hidden = true;
        }
      }
      if (d.img && img) {
        img.classList.remove("is-on");
        big.classList.remove("is-on");
        img.onload = () => img.classList.add("is-on");
        if (img.src.endsWith(d.img)) img.classList.add("is-on");
        else img.src = d.img;
        img.alt = `${d.title}, screenshot`;
      } else {
        if (img) img.classList.remove("is-on");
        big.classList.add("is-on");
        if (bigLabel) bigLabel.textContent = d.biglabel || "";
        countTo(d.big || "");
      }
    };

    const expand = (row) => {
      const open = row.getAttribute("aria-expanded") !== "true";
      rows.forEach((r) => r.setAttribute("aria-expanded", "false"));
      row.setAttribute("aria-expanded", String(open));
      const box = $(".row-details", row);
      if (open && box && !box.childElementCount) {
        const d = row.dataset;
        const parts = [];
        if (d.img) parts.push(`<img src="${d.img}" alt="${d.title}, screenshot" loading="lazy" decoding="async">`);
        parts.push(`<span>${d.desc}</span>`);
        const meta = [`<span>${d.stack}</span>`, `<span>${d.status}</span>`];
        if (d.link) meta.push(`<a href="${d.link}" target="_blank" rel="noreferrer" style="color:var(--accent)">${d.linkLabel || d.link}</a>`);
        if (d.receipt) meta.push(`<span class="receipt">${d.receipt}</span>`);
        parts.push(`<span class="preview-meta">${meta.join("")}</span>`);
        box.innerHTML = parts.join("");
      }
    };

    rows.forEach((row) => {
      row.addEventListener("pointerenter", () => isDesktop() && show(row));
      row.addEventListener("focus", () => isDesktop() && show(row));
      row.addEventListener("click", () => {
        if (isDesktop()) {
          show(row);
          const href = row.dataset.link;
          if (href) window.open(href, "_blank", "noopener");
        } else {
          expand(row);
        }
      });
    });
    if (preview) show(rows[0]);
  }

  /* ============================================================
     POINTER-LIT CARDS + MAGNETIC BUTTONS
     ============================================================ */
  if (finePointer) {
    $$(".repo-card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    });
    if (motionOK) {
      $$("[data-magnetic]").forEach((el) => {
        el.addEventListener("pointermove", (e) => {
          const r = el.getBoundingClientRect();
          const x = (e.clientX - (r.left + r.width / 2)) * 0.18;
          const y = (e.clientY - (r.top + r.height / 2)) * 0.18;
          el.style.transform = `translate(${x}px, ${y}px)`;
        });
        el.addEventListener("pointerleave", () => {
          el.style.transform = "";
        });
      });
    }
  }

  /* ============================================================
     COPY EMAIL
     ============================================================ */
  $$("[data-copy]").forEach((b) => {
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        toast("copied · amine@hamlouchi.com");
      } catch {
        toast("select and copy: " + b.dataset.copy);
      }
    });
  });

  /* ============================================================
     FOOTER YEAR
     ============================================================ */
  $$("[data-year]").forEach((el) => (el.textContent = String(new Date().getFullYear())));

  /* ============================================================
     TERMINAL
     ============================================================ */
  const term = $("[data-terminal]");
  if (term && typeof term.showModal === "function") {
    const scroll = $("[data-term-scroll]", term);
    const input = $("[data-term-input]", term);
    const history = [];
    let historyIdx = -1;
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const print = (html, cls = "line-out") => {
      const p = document.createElement("p");
      p.className = cls;
      p.innerHTML = html;
      scroll.appendChild(p);
      scroll.scrollTop = scroll.scrollHeight;
    };
    const printCmd = (cmd) => print(`<span class="user">amine@louisville:~$</span> ${esc(cmd)}`, "line-cmd");
    const LINK = (href, label) => `<a href="${href}" target="_blank" rel="noreferrer">${label || href}</a>`;
    const goto = (id) => {
      const t = $(id);
      if (!t) return `nothing at ${id}`;
      term.close();
      if (lenis) lenis.scrollTo(t, { offset: -72 });
      else t.scrollIntoView({ behavior: motionOK ? "smooth" : "auto" });
      return null;
    };

    const COMMANDS = {
      help: () =>
        [
          "available commands:",
          "  whoami       who is this guy",
          "  now          what I'm doing this semester",
          "  work         featured systems",
          "  receipts     every number on this site, with its source",
          "  community    masjid, MSA, dawah",
          "  code         public repos",
          "  arcade       playable games  (play checkers · play ttt)",
          "  skills       the toolbox",
          "  edu          education",
          "  resume       the pdf",
          "  contact      reach me",
          "  theme        dark · light",
          "  flip         flip the paper me",
          "  girih        toggle the lattice",
          "  arabic       لماذا العربية؟",
          "  sudo hire-me",
          "  clear · exit",
        ].join("\n"),
      whoami: () =>
        "Amine Hamlouchi. CS at the University of Louisville (Speed School), minor in Arabic.\nProduct engineering intern at Kamel Ride, IT analyst intern at Parker Hannifin,\ntechnical lead at Alnur Mosque, founder of Rumi and Minbar. Louisville, KY.",
      now: () =>
        "→ Kamel Ride · product engineering intern (Aug 2026–)\n→ Parker Hannifin · IT analyst intern (May 2026–)\n→ Alnur Mosque · technical lead, digital operations (2024–)\n→ UofL MSA · executive board (2025–26)",
      work: () => goto("#work"),
      receipts: () =>
        [
          "731 canonical arguments · 893 rebuttals · 1,100+ citations   résumé › Projects",
          "80 active users · 106 API routes · 51 regression tests         résumé › Projects",
          "10 MB client cap vs 5 MB server cap (the upload bug)            résumé › Experience",
          "11 pages · SHA-256 photo dedupe pipeline                        résumé › Experience",
          "14 centuries on one timeline                                    repo › timeline",
          "17k followers across platforms                                  Amine, Sep 2026",
        ].join("\n"),
      community: () => goto("#community"),
      msa: () => "UofL Muslim Student Association · executive board · 2025–26",
      dawah: () =>
        "educational Islamic reminders and short teaching posts · 17k followers across platforms\n→ " +
        LINK("https://www.tiktok.com/@aminehamlouchi", "tiktok") +
        " · " +
        LINK("https://www.youtube.com/@AmineHamlouchi", "youtube"),
      code: () => goto("#code"),
      arcade: () => goto("#arcade"),
      play: (args) => {
        const g = (args[0] || "").toLowerCase();
        if (g.startsWith("check")) return (location.href = "checkers.html"), null;
        if (g.startsWith("t")) return (location.href = "tic-tac-toe-3d.html"), null;
        return "play checkers · play ttt";
      },
      skills: () =>
        "languages : Python · Java · C · C++ · JS/TS · SQL · Bash\nai/ml     : RAG · LLM orchestration · NLP/IE · ETL · scikit-learn\nweb       : React · React Native · Next.js · Node/Express · FastAPI · Postgres/PostGIS · Supabase\ninfra     : Docker · GCP Cloud Run · Vercel · Pulumi · GitHub Actions",
      edu: () => "University of Louisville · J.B. Speed School of Engineering\nB.A. Computer Science · Minor in Arabic · GPA 3.5/4.0 · expected May 2028",
      resume: () => "→ " + LINK("assets/amine-hamlouchi-resume.pdf", "amine-hamlouchi-resume.pdf") + '  ·  <a href="resume.html">resume.html</a>',
      contact: () =>
        "email    : " +
        LINK("mailto:amine@hamlouchi.com", "amine@hamlouchi.com") +
        "\nuofl     : " +
        LINK("mailto:aahaml01@louisville.edu", "aahaml01@louisville.edu") +
        "\nphone    : " +
        LINK("tel:+15026931063", "(502) 693-1063") +
        "\ngithub   : " +
        LINK("https://github.com/aminehamlouchi", "github.com/aminehamlouchi") +
        "\nlinkedin : " +
        LINK("https://www.linkedin.com/in/aminehamlouchi", "linkedin.com/in/aminehamlouchi"),
      theme: (args) => {
        const want = (args[0] || "").toLowerCase();
        const next = want === "light" || want === "dark" ? want : currentTheme() === "dark" ? "light" : "dark";
        setTheme(next);
        return `theme → ${next}`;
      },
      flip: () => {
        window.dispatchEvent(new CustomEvent("amine:flip"));
        return "*paper flip*";
      },
      girih: () => (lattice ? (lattice.toggle() ? "lattice on" : "lattice off") : "no lattice on this page"),
      storm: () => (lattice ? (lattice.storm(), "girih storm, six seconds") : "no lattice on this page"),
      arabic: () => ({
        text: "أهلاً وسهلاً! أدرس العربية كتخصص فرعي، ولهذا يسكن شيء من العربية في زوايا هذا الموقع.",
        cls: "line-out ar",
      }),
      salaam: () => ({ text: "وعليكم السلام ورحمة الله وبركاته", cls: "line-out ar" }),
      neofetch: () =>
        [
          "  أمين      amine@louisville",
          "  ─────     ────────────────",
          "  os        hand-built html · no framework · no build step",
          "  shell     amine.sys v3",
          "  uptime    since 2024",
          "  langs     en · ar",
          "  kernel    speed school cs '28",
          "  packages  gsap · lenis · three (desktop only)",
        ].join("\n"),
      cv: () => "that page is private. if a family is meant to see it, they already have the link.",
      sudo: (args) =>
        args.join(" ") === "hire-me"
          ? "[sudo] permission granted.\nforwarding to " + LINK("mailto:amine@hamlouchi.com", "amine@hamlouchi.com") + " ..."
          : "amine is not in the sudoers file. this incident will be reported.",
      rm: () => "nice try.",
      ls: () => "now/  work/  community/  code/  arcade/  skills/  education/  contact/  resume.pdf",
      pwd: () => "/home/amine/louisville",
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
    COMMANDS.github = COMMANDS.code;
    COMMANDS.repos = COMMANDS.code;
    COMMANDS.masjid = COMMANDS.community;
    COMMANDS.nikah = COMMANDS.cv;
    COMMANDS.cat = (args) => {
      const key = (args[0] || "").replace(/\/$/, "").replace(/\.\w+$/, "");
      const target = COMMANDS[key];
      return target ? target([]) : `cat: ${esc(args[0] || "")}: no such file`;
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
        print(`command not found: ${esc(cmd)}. try 'help'`);
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
        print("amine.sys v3 · hand-built, no framework");
        print("type 'help' to look around.");
      }
      input.focus();
    };

    $$("[data-term-open]").forEach((b) => b.addEventListener("click", openTerm));
    const closeBtn = $("[data-term-close]", term);
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

  /* ============================================================
     EASTER EGGS — konami storm, brand triple-tap
     ============================================================ */
  const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let kIdx = 0;
  window.addEventListener("keydown", (e) => {
    if (/input|textarea/i.test(document.activeElement.tagName)) return;
    kIdx = e.key === KONAMI[kIdx] ? kIdx + 1 : e.key === KONAMI[0] ? 1 : 0;
    if (kIdx === KONAMI.length) {
      kIdx = 0;
      if (lattice) lattice.storm();
      toast("girih storm ✦ six seconds");
    }
  });
  const brand = $(".brand");
  if (brand) {
    let taps = 0;
    let tapT = 0;
    brand.addEventListener("click", (e) => {
      taps += 1;
      clearTimeout(tapT);
      tapT = setTimeout(() => (taps = 0), 700);
      if (taps === 3) {
        e.preventDefault();
        taps = 0;
        toast("أهلاً وسهلاً · welcome");
      }
    });
  }
})();
