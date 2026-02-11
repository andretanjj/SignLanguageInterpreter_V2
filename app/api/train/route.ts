import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { SIGN_LANGUAGES, SignLanguageKey } from "@/lib/signLanguages";

// POST /api/train { lang: "asl" | "bsl" }
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const lang = body.lang as SignLanguageKey;

        if (!lang || !SIGN_LANGUAGES[lang]) {
            return NextResponse.json({ error: "Invalid language" }, { status: 400 });
        }

        const config = SIGN_LANGUAGES[lang];
        const scriptPath = path.resolve(process.cwd(), "scripts/train.ts");

        // Construct arguments
        // npx tsx scripts/train.ts --lang x --dataset y --outDir z
        // We use "npx tsx" to run the typescript file directly
        const args = [
            "tsx",
            scriptPath,
            "--lang", lang,
            "--dataset", config.dataset.path,
            "--outDir", config.fsModelDir
        ];

        console.log(`API Training Triggered: npx ${args.join(" ")}`);

        // Spawn child process
        const child = spawn("npx", args, {
            cwd: process.cwd(),
            env: process.env, // Pass through env vars (PATH, etc)
        });

        const encoder = new TextEncoder();

        // Create a streaming response
        const stream = new ReadableStream({
            start(controller) {
                const send = (msg: string) => {
                    controller.enqueue(encoder.encode(msg));
                };

                child.stdout.on("data", (data) => {
                    const text = data.toString();
                    process.stdout.write(`[Train:${lang}] ${text}`); // Log to server console too
                    send(text);
                });

                child.stderr.on("data", (data) => {
                    const text = data.toString();
                    process.stderr.write(`[Train:${lang} ERR] ${text}`);
                    send(`ERR: ${text}`);
                });

                child.on("close", (code) => {
                    if (code === 0) {
                        send("\nTraining completed successfully!\n");
                    } else {
                        send(`\nTraining process exited with code ${code}\n`);
                    }
                    controller.close();
                });

                child.on("error", (err) => {
                    send(`\nFailed to start training process: ${err.message}\n`);
                    controller.close();
                });
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Transfer-Encoding": "chunked"
            }
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
