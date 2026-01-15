import { Alert, Progress, Spinner } from "@heroui/react";
import { DataFrame } from "danfojs";
import { useMemo, useState } from "react";
import { useAsyncEffect } from "rooks";
import { App } from "./app";
import { publicUrl } from "./utils";

type LoaderState =
  | { df: DataFrame; phase: "ready" }
  | { message: string; phase: "error" }
  | { phase: "loading"; ratio: null | number };

type WorkerMsg =
  | { message: string; type: "error" }
  | { pagesDone: number; type: "progress" }
  | { rows: Record<string, unknown>[]; type: "done" };

export async function fetchArrayBufferWithProgress(
  url: string | URL,
  signal: AbortSignal,
  onProgress: (ratio: number) => void,
): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });

  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  const lenHeader = res.headers.get("content-length");
  const total = lenHeader ? Number(lenHeader) : 0;
  const reader = res.body?.getReader();

  if (!reader) {
    return await res.arrayBuffer();
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
    loaded += value.byteLength;

    if (total > 0) {
      onProgress(loaded / total);
    }
  }

  onProgress(1);

  const out = new Uint8Array(loaded);
  let off = 0;

  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }

  return out.buffer;
}

export function Loader(): React.JSX.Element {
  const [state, setState] = useState<LoaderState>({
    phase: "loading",
    ratio: null,
  });

  const parquetUrl = useMemo(() => publicUrl("data/title_basics.parquet"), []);

  useAsyncEffect(async () => {
    const ac = new AbortController();

    try {
      const buf = await fetchArrayBufferWithProgress(
        parquetUrl,
        ac.signal,
        (ratio) => {
          setState({ phase: "loading", ratio });
        },
      );

      const rows = await parseParquetInWorker(buf);
      const df = new DataFrame(rows);

      setState({ df, phase: "ready" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ message: msg, phase: "error" });
    }

    return () => {
      ac.abort();
    };
  }, [parquetUrl]);

  switch (state.phase) {
    case "error":
      return (
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{
            background:
              "radial-gradient(ellipse at center, #1f2937 0%, #000000 85%)",
          }}
        >
          <Alert
            color="danger"
            description={state.message}
            title="Failed to load data"
            variant="faded"
          />
        </div>
      );
    case "loading":
      return <LoadingScreen ratio={state.ratio} />;
    case "ready":
      return <App df={state.df} />;
  }
}

function LoadingScreen(props: { ratio: null | number }): React.JSX.Element {
  const percentage = props.ratio !== null ? Math.round(props.ratio * 100) : 0;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-12 p-8"
      style={{
        background:
          "radial-gradient(ellipse at center, #1f2937 0%, #000000 85%)",
      }}
    >
      <div className="text-8xl">🎬🍿</div>
      <h1
        className="text-5xl font-bold text-white"
        style={{ fontFamily: "'Hahmlet', serif" }}
      >
        Popcorn Plots
      </h1>

      <div className="w-full max-w-xl space-y-4">
        <Progress
          aria-label="Loading data"
          classNames={{
            indicator: "bg-gradient-to-r from-indigo-500 to-purple-500",
            track: "bg-gray-700",
          }}
          size="lg"
          value={percentage}
        />
        <p className="flex items-center justify-center gap-3 text-xl text-gray-400">
          <Spinner
            classNames={{
              circle1: "border-b-indigo-500",
              circle2: "border-b-purple-500",
            }}
            size="sm"
          />
          Loading data… {percentage}%
        </p>
      </div>
    </div>
  );
}

async function parseParquetInWorker(
  buf: ArrayBuffer,
): Promise<Record<string, unknown>[]> {
  const worker = new Worker(new URL("./parquet.worker.ts", import.meta.url), {
    type: "module",
  });

  return await new Promise((resolve, reject) => {
    worker.onmessage = ({ data: msg }: MessageEvent<WorkerMsg>) => {
      switch (msg.type) {
        case "done":
          worker.terminate();
          resolve(msg.rows);
          break;
        case "error":
          worker.terminate();
          reject(new Error(msg.message));
          break;
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(new Error(err.message));
    };

    worker.postMessage({ buf, type: "parse" }, [buf]); // transfer (no copy)
  });
}
