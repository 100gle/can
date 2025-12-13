import { memo } from "react";

/**
 * SketchBackground - A decorative SVG background with sketch-style dashed grid lines.
 * Creates a hand-drawn aesthetic with square grid pattern and center focus effect.
 */
export const SketchBackground = memo(() => {
  const gridSize = 18; // Denser square grid

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* Gradient background layer */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.12] via-background to-accent/[0.18]" />

      {/* Grid SVG layer */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Square grid pattern with dashed lines */}
          <pattern
            id="square-grid"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            {/* Horizontal line */}
            <line
              x1="0"
              y1={gridSize}
              x2={gridSize}
              y2={gridSize}
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="3 2"
              className="text-foreground/[0.1]"
            />
            {/* Vertical line */}
            <line
              x1={gridSize}
              y1="0"
              x2={gridSize}
              y2={gridSize}
              stroke="currentColor"
              strokeWidth="0.5"
              strokeDasharray="3 2"
              className="text-foreground/[0.1]"
            />
          </pattern>

          {/* Radial gradient mask for center fade/focus effect */}
          <radialGradient id="center-fade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="25%" stopColor="white" stopOpacity="0.15" />
            <stop offset="55%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </radialGradient>

          <mask id="grid-mask">
            <rect width="100%" height="100%" fill="url(#center-fade)" />
          </mask>
        </defs>

        {/* Square grid with center fade mask */}
        <rect width="100%" height="100%" fill="url(#square-grid)" mask="url(#grid-mask)" />
      </svg>

      {/* Center blur/glow effect layer */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 55% at 50% 45%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.35) 30%, transparent 60%)",
          backdropFilter: "blur(1px)",
        }}
      />

      {/* Additional soft vignette for depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 25%, rgba(0,0,0,0.06) 100%)",
        }}
      />
    </div>
  );
});

SketchBackground.displayName = "SketchBackground";
