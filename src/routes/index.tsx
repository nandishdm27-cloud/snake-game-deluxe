import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neon Snake — Classic Arcade Snake Game" },
      {
        name: "description",
        content:
          "Play Neon Snake, a fast classic snake game on a 20x20 grid. Use arrow keys, grow your snake, and beat your high score.",
      },
      { property: "og:title", content: "Neon Snake — Classic Arcade Snake Game" },
      {
        property: "og:description",
        content: "Classic snake on a 20x20 neon grid. Arrow keys to play, chase your high score.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SnakeGame,
});

const SIZE = 20;
const CENTER = Math.floor(SIZE / 2);
const INITIAL_SNAKE = [
  { x: CENTER, y: CENTER },
  { x: CENTER - 1, y: CENTER },
  { x: CENTER - 2, y: CENTER },
];
const DIRS = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
} as const;

type Point = { x: number; y: number };
type Status = "idle" | "running" | "paused" | "over";

const key = (p: Point) => `${p.x},${p.y}`;

function randomFood(snake: Point[]): Point {
  const taken = new Set(snake.map(key));
  const free: Point[] = [];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) if (!taken.has(`${x},${y}`)) free.push({ x, y });
  return free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 };
}

function SnakeGame() {
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [food, setFood] = useState<Point>({ x: CENTER + 5, y: CENTER });
  const [status, setStatus] = useState<Status>("idle");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);

  const dir = useRef<Point>({ x: 1, y: 0 });
  const queued = useRef<Point[]>([]);

  useEffect(() => {
    const stored = Number(localStorage.getItem("neon-snake-best") ?? 0);
    if (!Number.isNaN(stored)) setBest(stored);
  }, []);

  const reset = useCallback(() => {
    setSnake(INITIAL_SNAKE);
    setFood(randomFood(INITIAL_SNAKE));
    setScore(0);
    dir.current = { x: 1, y: 0 };
    queued.current = [];
    setStatus("running");
  }, []);

  const turn = useCallback((next: Point) => {
    const last = queued.current.at(-1) ?? dir.current;
    if (last.x === -next.x && last.y === -next.y) return;
    if (last.x === next.x && last.y === next.y) return;
    if (queued.current.length < 2) queued.current.push(next);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key in DIRS) {
        e.preventDefault();
        if (status === "idle" || status === "over") reset();
        else if (status === "paused") setStatus("running");
        turn(DIRS[e.key as keyof typeof DIRS]);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (status === "running") setStatus("paused");
        else if (status === "paused") setStatus("running");
        else reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, reset, turn]);

  const speed = useMemo(() => Math.max(70, 150 - Math.floor(score / 3) * 8), [score]);

  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      setSnake((prev) => {
        const nextDir = queued.current.shift() ?? dir.current;
        dir.current = nextDir;
        const first = prev[0]!;
        const head = { x: first.x + nextDir.x, y: first.y + nextDir.y };

        if (head.x < 0 || head.y < 0 || head.x >= SIZE || head.y >= SIZE) {
          setStatus("over");
          return prev;
        }
        const ate = head.x === food.x && head.y === food.y;
        const body = ate ? prev : prev.slice(0, -1);
        if (body.some((s) => s.x === head.x && s.y === head.y)) {
          setStatus("over");
          return prev;
        }
        const next = [head, ...body];
        if (ate) {
          setFood(randomFood(next));
          setScore((s) => s + 1);
        }
        return next;
      });
    }, speed);
    return () => clearInterval(id);
  }, [status, speed, food]);

  useEffect(() => {
    if (status === "over" && score > best) {
      setBest(score);
      localStorage.setItem("neon-snake-best", String(score));
    }
  }, [status, score, best]);

  const snakeSet = useMemo(() => new Map(snake.map((p, i) => [key(p), i])), [snake]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="text-4xl font-black tracking-tight text-primary sm:text-5xl">NEON SNAKE</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Arrow keys to steer · Space to pause
        </p>
      </header>

      <div className="flex w-full max-w-[min(90vw,540px)] items-center justify-between gap-4">
        <Stat label="Score" value={score} />
        <Stat label="Best" value={best} />
      </div>

      <div className="relative rounded-2xl border border-border bg-card p-3 shadow-2xl">
        <div
          className="grid aspect-square w-[min(88vw,520px)] gap-px overflow-hidden rounded-xl bg-grid-line"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: SIZE * SIZE }, (_, i) => {
            const x = i % SIZE;
            const y = Math.floor(i / SIZE);
            const idx = snakeSet.get(`${x},${y}`);
            const isFood = food.x === x && food.y === y;
            return (
              <div
                key={i}
                className="bg-board transition-colors duration-75"
                style={
                  idx !== undefined
                    ? {
                        backgroundColor: "var(--primary)",
                        opacity: 1 - Math.min(idx, 18) * 0.03,
                        boxShadow: idx === 0 ? "var(--glow-snake)" : undefined,
                        borderRadius: idx === 0 ? "35%" : "20%",
                      }
                    : isFood
                      ? {
                          backgroundColor: "var(--food)",
                          boxShadow: "var(--glow-food)",
                          borderRadius: "50%",
                        }
                      : undefined
                }
              />
            );
          })}
        </div>

        {status !== "running" && (
          <div className="absolute inset-3 flex flex-col items-center justify-center gap-4 rounded-xl bg-background/85 backdrop-blur-sm">
            <p className="text-2xl font-bold text-foreground">
              {status === "idle" ? "Ready?" : status === "paused" ? "Paused" : "Game Over"}
            </p>
            {status === "over" && (
              <p className="text-sm text-muted-foreground">You scored {score}</p>
            )}
            <Button
              size="lg"
              onClick={() => (status === "paused" ? setStatus("running") : reset())}
            >
              {status === "idle" ? "Start Game" : status === "paused" ? "Resume" : "Play Again"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:hidden">
        <span />
        <PadButton onPress={() => turn(DIRS.ArrowUp)} label="↑" />
        <span />
        <PadButton onPress={() => turn(DIRS.ArrowLeft)} label="←" />
        <PadButton onPress={() => turn(DIRS.ArrowDown)} label="↓" />
        <PadButton onPress={() => turn(DIRS.ArrowRight)} label="→" />
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-center">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function PadButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Button variant="secondary" size="lg" onClick={onPress} aria-label={label}>
      {label}
    </Button>
  );
}
