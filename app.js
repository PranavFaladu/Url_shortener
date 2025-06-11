import { readFile, writeFile } from "fs/promises";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3002;
const DATA_FILE = path.join(__dirname, "url", "data", "link.json");

const loadLinks = async () => {
    try {
        const data = await readFile(DATA_FILE, "utf-8");
        if (!data) {
            // If file is empty, return empty object instead of parsing
            return {};
        }
        return JSON.parse(data);
    } catch (error) {
        if (error.code === "ENOENT") {
            await writeFile(DATA_FILE, JSON.stringify({}), "utf-8");
            return {};
        }
        throw error;
    }
};

const saveLinks = async (links) => {
    await writeFile(DATA_FILE, JSON.stringify(links, null, 2), "utf-8");
};

const server = createServer(async (req, res) => {
    console.log("Request URL:", req.url);

    if (req.method === "GET") {
        if (req.url === "/") {
            try {
                const data = await readFile(path.join(__dirname, "url", "public", "index.html"), "utf-8");
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(data);
            } catch (error) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("404 page not found");
            }
        } else if (req.url === "/style.css") {
            try {
                const data = await readFile(path.join(__dirname, "url", "public", "style.css"), "utf-8");
                res.writeHead(200, { "Content-Type": "text/css" });
                res.end(data);
            } catch (error) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("404 page not found");
            }
        } else if (req.url.startsWith("/favicon.ico")) {
            res.writeHead(204);
            res.end();
        } else {
            const links = await loadLinks();
            const shortCode = req.url.slice(1);
            const originalUrl = links[shortCode];
            if (originalUrl) {
                res.writeHead(302, { Location: originalUrl });
                res.end();
            } else {
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.end("Short URL not found");
            }
        }
    }

    if (req.method === "POST" && req.url === "/shorten") {
        let body = "";
        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", async () => {
            try {
                console.log("Received body:", body);
                const { url, shortCode } = JSON.parse(body);

                if (!url) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    return res.end("URL is required");
                }

                const links = await loadLinks();
                const finalShortCode = shortCode?.trim() || crypto.randomBytes(4).toString("hex");

                if (links[finalShortCode]) {
                    res.writeHead(400, { "Content-Type": "text/plain" });
                    return res.end("Short code already exists. Please choose another.");
                }

                links[finalShortCode] = url;
                await saveLinks(links);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true, shortCode: finalShortCode }));

            } catch (err) {
                console.error("POST /shorten error:", err);
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("Internal Server Error");
            }
        });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
});
