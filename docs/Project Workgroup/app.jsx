const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "primary": "#EA580C",
  "dark": false,
  "density": "regular",
  "typeFamily": "plex",
  "radiusScale": 1,
  "ganttStyle": "flat"
}/*EDITMODE-END*/;

const PRIMARY_RAMPS = {
  // hex → 9-stop ramps. Hand-picked so light/dark surfaces work in both.
  "#EA580C": ["#FFF3EA","#FFE2CC","#FFC79C","#FDA46B","#F9803D","#EA580C","#C2410C","#9A3412","#7C2D12"],
  "#4F46E5": ["#EEF0FF","#D8DAFD","#BCBFFB","#9EA0F7","#7B7AF1","#4F46E5","#4036C4","#3128A0","#262080"],
  "#0EA5E9": ["#E8F6FE","#CBEAFB","#9DD8F7","#6CC1F2","#3CA9EB","#0EA5E9","#0284C7","#0369A1","#0C4A6E"],
  "#059669": ["#E6F5EE","#C2E7D2","#94D2B0","#65BC8F","#3FAA75","#059669","#047857","#065F46","#064E3B"],
  "#475569": ["#EEF2F7","#D6DDE6","#B9C3D1","#98A4B7","#6E7E94","#475569","#36465A","#28354A","#1B2536"]
};

function applyTokenSideEffects(t) {
  const root = document.documentElement;
  root.setAttribute("data-theme", t.dark ? "dark" : "light");
  root.setAttribute("data-density", t.density);
  root.setAttribute("data-type", t.typeFamily);
  root.setAttribute("data-gantt", t.ganttStyle);
  root.style.setProperty("--r-scale", String(t.radiusScale));
  const ramp = PRIMARY_RAMPS[t.primary] || PRIMARY_RAMPS["#EA580C"];
  ["50","100","200","300","400","500","600","700","800"].forEach((stop, i) => {
    root.style.setProperty(`--p-${stop}`, ramp[i]);
  });
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Re-apply on every change
  React.useEffect(() => { applyTokenSideEffects(t); }, [t]);

  // Theme toggle (top bar)
  React.useEffect(() => {
    const wrap = document.getElementById("themeToggle");
    if (!wrap) return;
    const handler = (e) => {
      const btn = e.target.closest("button[data-mode]");
      if (!btn) return;
      setTweak("dark", btn.dataset.mode === "dark");
    };
    wrap.addEventListener("click", handler);
    return () => wrap.removeEventListener("click", handler);
  }, [setTweak]);

  // Keep theme-toggle visual state synced
  React.useEffect(() => {
    document.querySelectorAll("#themeToggle button").forEach((b) => {
      b.classList.toggle("active", b.dataset.mode === (t.dark ? "dark" : "light"));
    });
  }, [t.dark]);

  // Scrollspy
  React.useEffect(() => {
    const sections = [...document.querySelectorAll("main .section, main #overview")];
    const links = [...document.querySelectorAll(".sidebar .nav-item")];
    const byId = Object.fromEntries(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((l) => l.classList.remove("active"));
          const id = e.target.id;
          if (byId[id]) byId[id].classList.add("active");
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px", threshold: 0 });
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <TweaksPanel title="Tweaks · DS">
      <TweakSection label="Tema">
        <TweakToggle label="Modo oscuro" value={t.dark}
          onChange={(v) => setTweak("dark", v)} />
        <TweakColor label="Primario" value={t.primary}
          options={["#EA580C","#4F46E5","#0EA5E9","#059669","#475569"]}
          onChange={(v) => setTweak("primary", v)} />
      </TweakSection>
      <TweakSection label="Densidad">
        <TweakRadio label="Densidad" value={t.density}
          options={["compact","regular","comfy"]}
          onChange={(v) => setTweak("density", v)} />
      </TweakSection>
      <TweakSection label="Tipografía">
        <TweakRadio label="Familia" value={t.typeFamily}
          options={[
            { value:"plex", label:"Plex" },
            { value:"humanist", label:"Public" },
            { value:"grotesk", label:"Grotesk" },
          ]}
          onChange={(v) => setTweak("typeFamily", v)} />
      </TweakSection>
      <TweakSection label="Forma">
        <TweakSlider label="Radio · escala" value={t.radiusScale}
          min={0} max={2} step={0.25} unit="×"
          onChange={(v) => setTweak("radiusScale", v)} />
      </TweakSection>
      <TweakSection label="Gantt">
        <TweakRadio label="Estilo" value={t.ganttStyle}
          options={[
            { value:"flat", label:"Flat" },
            { value:"layered", label:"Layered" },
            { value:"ascii", label:"ASCII" },
          ]}
          onChange={(v) => setTweak("ganttStyle", v)} />
      </TweakSection>
    </TweaksPanel>
  );
}

applyTokenSideEffects(TWEAK_DEFAULTS);

ReactDOM.createRoot(document.getElementById("tweaks-root")).render(<App />);
