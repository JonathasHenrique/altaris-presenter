import { defineConfig } from "vite";
import { resolve } from "path";
import * as fs from "fs";
import * as os from "os";
import { execFile } from "child_process";

const TELEMETRY_LOG = "/home/jonathas/.gemini/antigravity/brain/d38950f8-0390-4f17-a1ad-9893bb09b79e/scratch/telemetry.log";
const VIDEOS_DIR = resolve(__dirname, "public/data/videos");
const BIBLES_DIR = resolve(__dirname, "public/data/bibles");

let pendingTestCommand: string | null = null;
let lastTestResult: any = null;

export default defineConfig({
  clearScreen: false,
  plugins: [
    {
      name: "openpresenter-live-telemetry",
      configureServer(server) {
        server.middlewares.use("/__telemetry", (req, res) => {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString();
          });
          req.on("end", () => {
            try {
              const line = `[${new Date().toISOString()}] ${body}\n`;
              fs.appendFileSync(TELEMETRY_LOG, line);
            } catch {}
            res.statusCode = 200;
            res.end("ok");
          });
        });

        server.middlewares.use("/__upload_media", (req, res) => {
          const urlObj = new URL(req.url || "", "http://localhost:5173");
          const ext = (urlObj.searchParams.get("ext") || "mp4").replace(/[^a-z0-9]/gi, "");
          const origName = urlObj.searchParams.get("name") || `midia.${ext}`;
          const chunks: Buffer[] = [];
          req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          req.on("end", () => {
            try {
              fs.mkdirSync(VIDEOS_DIR, { recursive: true });
              const fname = `uploaded_${Date.now()}.${ext}`;
              const fpath = resolve(VIDEOS_DIR, fname);
              fs.writeFileSync(fpath, Buffer.concat(chunks));
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ url: `/data/videos/${fname}`, name: origName }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        });

        server.middlewares.use("/__save_bible", (req, res) => {
          const urlObj = new URL(req.url || "", "http://localhost:5173");
          const id = (urlObj.searchParams.get("id") || "custom").replace(/[^a-z0-9_-]/gi, "").toLowerCase();
          const chunks: Buffer[] = [];
          req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          req.on("end", () => {
            try {
              fs.mkdirSync(BIBLES_DIR, { recursive: true });
              const fname = `biblia_${id}.json`;
              const fpath = resolve(BIBLES_DIR, fname);
              fs.writeFileSync(fpath, Buffer.concat(chunks));
              res.setHeader("Content-Type", "application/json");
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true, url: `/data/bibles/${fname}` }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        });

        server.middlewares.use("/__convert_presentation", (req, res) => {
          const urlObj = new URL(req.url || "", "http://localhost:5173");
          const ext = (urlObj.searchParams.get("ext") || "pptx").replace(/[^a-z0-9]/gi, "").toLowerCase();
          const chunks: Buffer[] = [];
          req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          req.on("end", () => {
            try {
              const tempDir = os.tmpdir();
              const uniquePrefix = `altaris_pres_${Date.now()}`;
              const inPath = resolve(tempDir, `${uniquePrefix}.${ext}`);
              const outPdfPath = resolve(tempDir, `${uniquePrefix}.pdf`);
              fs.writeFileSync(inPath, Buffer.concat(chunks));

              execFile(
                "soffice",
                ["--headless", "--convert-to", "pdf", inPath, "--outdir", tempDir],
                { timeout: 90000 },
                (err: any) => {
                  try {
                    if (fs.existsSync(inPath)) fs.unlinkSync(inPath);
                  } catch {}

                  if (!fs.existsSync(outPdfPath)) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: err ? err.message : "Conversão não gerou PDF" }));
                    return;
                  }

                  const pdfBytes = fs.readFileSync(outPdfPath);
                  try {
                    fs.unlinkSync(outPdfPath);
                  } catch {}

                  res.setHeader("Content-Type", "application/pdf");
                  res.setHeader("Content-Length", pdfBytes.length);
                  res.statusCode = 200;
                  res.end(pdfBytes);
                }
              );
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e.message }));
            }
          });
        });

        server.middlewares.use("/__test_poll", (req, res) => {
          if (req.method === "POST") {
            let body = "";
            req.on("data", (c) => (body += c.toString()));
            req.on("end", () => {
              try {
                const parsed = JSON.parse(body);
                if (parsed.enqueueCommand) {
                  pendingTestCommand = parsed.enqueueCommand;
                  lastTestResult = null;
                } else if (parsed.reportResult !== undefined) {
                  lastTestResult = parsed.reportResult;
                }
              } catch {}
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, lastTestResult }));
            });
            return;
          }
          res.setHeader("Content-Type", "application/json");
          if (req.url && req.url.includes("status=1")) {
            res.end(JSON.stringify({ lastTestResult }));
            return;
          }
          const cmd = pendingTestCommand;
          pendingTestCommand = null;
          res.end(JSON.stringify({ command: cmd, lastTestResult }));
        });
      }
    }
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: "0.0.0.0"
  },
  build: {
    target: "esnext",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        audience: resolve(__dirname, "audience.html"),
        stage: resolve(__dirname, "stage.html"),
        stream: resolve(__dirname, "stream.html"),
        remote: resolve(__dirname, "remote.html")
      }
    }
  }
});
