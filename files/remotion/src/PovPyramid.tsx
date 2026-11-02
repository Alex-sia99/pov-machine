import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { z } from "zod";

// Pyramide de rangs de la machine POV — la signature visuelle de la niche « Your Life as Every Rank ».
// Fond blanc, 10 cartes-portraits en 4 / 3 / 2 / 1 (Level 1-4 en bas, Level 10 au sommet = silhouette),
// ~1 s de pyramide entière puis ZOOM sur la carte du niveau courant avec un gros « Level N ».
// Rendu directement en MP4 (que des images fixes : aucun décodage vidéo, donc aucun gel).
// Les cartes sont copiées par la machine dans remotion/public/<dir>/card-<n>.png (staticFile).
export const FPS = 30;

export const povPyramidSchema = z.object({
  dir: z.string(),
  cards: z.array(z.string()), // noms de fichiers dans public/<dir>/ — "" = silhouette dessinée en CSS
  level: z.number(),          // niveau courant (1-based)
  label: z.string(),          // texte du zoom, ex. "Level 3"
  seconds: z.number(),
});
type Props = z.infer<typeof povPyramidSchema>;

const W = 1920, H = 1080;
const CARD_W = 330, CARD_H = 186, GAP_X = 22, GAP_Y = 18, BORDER = 7;

/** Position (centre) de chaque carte, rangées 4/3/2/1 depuis le bas. */
function layout(n: number): { x: number; y: number }[] {
  const rows: number[][] = [];
  let i = 0;
  const sizes = n <= 6 ? [3, 2, 1] : n <= 8 ? [3, 3, 2] : [4, 3, 2, 1];
  for (const s of sizes) {
    const row: number[] = [];
    for (let k = 0; k < s && i < n; k++) row.push(i++);
    rows.push(row);
  }
  while (i < n) rows[rows.length - 1].push(i++);
  const total = rows.length * CARD_H + (rows.length - 1) * GAP_Y;
  const top = (H - total) / 2;
  const out: { x: number; y: number }[] = new Array(n);
  rows.forEach((row, r) => {
    const y = top + (rows.length - 1 - r) * (CARD_H + GAP_Y) + CARD_H / 2;
    const rowW = row.length * CARD_W + (row.length - 1) * GAP_X;
    row.forEach((idx, k) => {
      out[idx] = { x: (W - rowW) / 2 + k * (CARD_W + GAP_X) + CARD_W / 2, y };
    });
  });
  return out;
}

const Silhouette: React.FC = () => (
  <div style={{ width: "100%", height: "100%", background: "linear-gradient(180deg,#2a2d33 0%,#15171b 100%)", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", left: "50%", top: "22%", width: "34%", height: "46%", transform: "translateX(-50%)", background: "#0b0c0e", borderRadius: "48% 48% 40% 40%" }} />
    <div style={{ position: "absolute", left: "50%", top: "62%", width: "70%", height: "50%", transform: "translateX(-50%)", background: "#0b0c0e", borderRadius: "50% 50% 0 0" }} />
    <div style={{ position: "absolute", left: "40%", top: "38%", width: "7%", height: "6%", background: "#ff2a2a", borderRadius: "50%", boxShadow: "0 0 18px 6px rgba(255,40,40,.75)" }} />
    <div style={{ position: "absolute", left: "53%", top: "38%", width: "7%", height: "6%", background: "#ff2a2a", borderRadius: "50%", boxShadow: "0 0 18px 6px rgba(255,40,40,.75)" }} />
  </div>
);

const Card: React.FC<{ src: string; dir: string; n: number; x: number; y: number; big?: boolean }> = ({ src, dir, n, x, y, big }) => (
  <div
    style={{
      position: "absolute",
      left: x - CARD_W / 2,
      top: y - CARD_H / 2,
      width: CARD_W,
      height: CARD_H,
      border: `${BORDER}px solid #111`,
      borderRadius: 12,
      overflow: "hidden",
      background: "#ddd",
      boxShadow: "0 6px 18px rgba(0,0,0,.18)",
    }}
  >
    {src ? <Img src={staticFile(`${dir}/${src}`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Silhouette />}
    {!big && (
      <div
        style={{
          position: "absolute",
          left: 0, right: 0, bottom: 6,
          textAlign: "center",
          color: "#fff",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: 900,
          fontSize: 24,
          letterSpacing: 0.3,
          WebkitTextStroke: "1.2px #000",
          textShadow: "0 0 6px #000, 0 2px 0 #000",
        }}
      >
        Level {n}
      </div>
    )}
  </div>
);

export const PovPyramid: React.FC<Props> = ({ dir, cards, level, label, seconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = Math.max(3, cards.length);
  const pos = layout(n);
  const cur = Math.min(Math.max(level, 1), n) - 1;

  // Timeline : 0 → 1.0 s pyramide fixe (fondu d'entrée 0.25 s), 1.0 → 1.9 s zoom, puis maintien.
  const holdEnd = Math.round(1.0 * fps);
  const zoomEnd = Math.round(1.9 * fps);
  const fadeIn = interpolate(frame, [0, Math.round(0.25 * fps)], [0, 1], { extrapolateRight: "clamp" });
  const t = interpolate(frame, [holdEnd, zoomEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

  // Échelle finale : la carte occupe ~62 % de la largeur de l'écran
  const scale = 1 + t * (W * 0.62 / CARD_W - 1);
  const cx = pos[cur].x, cy = pos[cur].y;
  const tx = (W / 2 - cx) * t;
  const ty = (H / 2 - cy) * t;
  const labelOpacity = interpolate(frame, [zoomEnd - 6, zoomEnd + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const outFade = interpolate(frame, [Math.round(seconds * fps) - 5, Math.round(seconds * fps)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#fff", opacity: fadeIn * outFade }}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${tx}px, ${ty}px) scale(${scale})`, transformOrigin: `${cx}px ${cy}px` }}>
        {pos.map((p, i) => (
          <Card key={i} src={cards[i] || ""} dir={dir} n={i + 1} x={p.x} y={p.y} big={t > 0.5 && i === cur} />
        ))}
      </div>
      {/* Gros libellé du niveau, posé sous la carte zoomée */}
      <div
        style={{
          position: "absolute",
          left: 0, right: 0,
          top: H / 2 + (CARD_H * scale) / 2 - 150,
          textAlign: "center",
          opacity: labelOpacity,
          color: "#fff",
          fontFamily: "Arial Black, Arial, Helvetica, sans-serif",
          fontWeight: 900,
          fontSize: 118,
          WebkitTextStroke: "4px #000",
          textShadow: "0 0 14px #000, 0 4px 0 #000, 0 -4px 0 #000",
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
};
