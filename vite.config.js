import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

// Note: Ensure these files exist (or generate self-signed certificates) in the "certs" folder
const certDir = path.resolve(__dirname, 'certs')
const https = {
  key: fs.readFileSync(path.join(certDir, 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(certDir, 'localhost-cert.pem')),
}

export default defineConfig({
  server: {
    host: true,
    // https
  }
}) 