import { parquetReadObjects } from "hyparquet";
import { compressors } from "hyparquet-compressors";

interface InMsg {
  buf: ArrayBuffer;
  type: "parse";
}

type OutMsg =
  | { message: string; type: "error" }
  | { rows: Record<string, unknown>[]; type: "done" };

self.onmessage = async ({ data: { buf } }: MessageEvent<InMsg>) => {
  try {
    const result = await parquetReadObjects({ compressors, file: buf });
    self.postMessage({ rows: result, type: "done" } satisfies OutMsg);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage({ message, type: "error" } satisfies OutMsg);
  }
};
