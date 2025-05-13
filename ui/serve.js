/* eslint-env node */
/* global process */
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import history from 'connect-history-api-fallback';

// Load environment variables
dotenv.config();

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.FRONTEND_PORT || 5173;

// Setup proxies
const backendPort = process.env.BACKEND_PORT || 5005;
const backendUrl = `http://localhost:${backendPort}`;
const wsBackendUrl =`ws://localhost:${backendPort}`;

// API proxy
app.use('/api', createProxyMiddleware({
    target: backendUrl,
    changeOrigin: false,
    pathRewrite: {
        '^/api': ''
    },
    onError: (err, req, res) => {
        console.error('API Proxy Error:', err);
        res.status(500).send('API Proxy Error');
    }
}));

// WebSocket proxy
app.use('/socket.io', createProxyMiddleware({
    target: wsBackendUrl,
    changeOrigin: false,
    ws: true,    
    onError: (err, req, res) => {
        console.error('WebSocket Proxy Error:', err);
        // For WebSocket errors, we can't send a response, just log the error
        if (res && res.writeHead) {
            res.writeHead(500);
            res.end('WebSocket Proxy Error');
        }
    }
}));

// Support for HTML5 History API
app.use(history());

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for SPA routing
app.get('*name', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`API Proxy target: ${backendUrl}`);
    console.log(`WebSocket Proxy target: ${wsBackendUrl}`);
}); 