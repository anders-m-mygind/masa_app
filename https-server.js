const https = require("https");
const fs = require("fs");
const path = require("path");

const root = process.cwd();
const certDir = path.join(root, "certs");
const keyPath = path.join(certDir, "localhost-key.pem");
const certPath = path.join(certDir, "localhost-cert.pem");
const port = Number(process.env.PORT) || 8443;

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error("Missing TLS certs. Generate them with:");
  console.error(
    "openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/localhost-key.pem -out certs/localhost-cert.pem -days 365 -subj \"/CN=localhost\""
  );
  process.exit(1);
}

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = https.createServer(
  {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  },
  (req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0] || "/");
    const safePath = path.normalize(urlPath).replace(/^\/+/, "");
    const filePath = path.join(root, safePath || "index.html");

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    const finalPath = fs.existsSync(filePath) ? filePath : path.join(root, "index.html");
    const ext = path.extname(finalPath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    fs.readFile(finalPath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    });
  }
);

server.listen(port, "0.0.0.0", () => {
  console.log(`HTTPS server running on https://localhost:${port}`);
  console.log("Use your machine's IP on your phone, e.g. https://192.168.x.x:8443");
});
