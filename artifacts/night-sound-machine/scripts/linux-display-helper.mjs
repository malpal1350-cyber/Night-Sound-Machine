#!/usr/bin/env node

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = Number(process.env.DISPLAY_HELPER_PORT || 17841);

function run(command, args, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'ignore',
      env: process.env,
    });
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish(false);
    }, timeoutMs);
    child.once('error', () => finish(false));
    child.once('exit', (code) => finish(code === 0));
  });
}

function sessionType() {
  const value = (process.env.XDG_SESSION_TYPE || '').toLowerCase();
  if (value === 'x11' || value === 'wayland') return value;
  if (process.env.WAYLAND_DISPLAY) return 'wayland';
  if (process.env.DISPLAY) return 'x11';
  return '';
}

async function sleepDisplay() {
  if (process.platform !== 'linux') {
    return { ok: false, reason: 'Linux helper only' };
  }

  const type = sessionType();
  if (type === 'x11') {
    return { ok: await run('xset', ['dpms', 'force', 'off']), method: 'x11' };
  }

  if (type === 'wayland') {
    const desktop = `${process.env.XDG_CURRENT_DESKTOP || ''} ${process.env.DESKTOP_SESSION || ''}`.toLowerCase();

    // GNOME's session screen saver API works on Ubuntu's default Wayland desktop
    // without locking the session.
    if (desktop.includes('gnome') || desktop.includes('ubuntu')) {
      const gnome = await run('gdbus', [
        'call',
        '--session',
        '--dest',
        'org.gnome.ScreenSaver',
        '--object-path',
        '/org/gnome/ScreenSaver',
        '--method',
        'org.gnome.ScreenSaver.SetActive',
        'true',
      ]);
      if (gnome) return { ok: true, method: 'gnome-screensaver' };
    }

    // Sway/wlroots can power outputs down without affecting the session.
    if (process.env.SWAYSOCK && await run('swaymsg', ['output', '*', 'power', 'off'])) {
      return { ok: true, method: 'sway' };
    }
  }

  return { ok: false, reason: 'No supported Linux display session detected' };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/display/sleep') {
    const result = await sleepDisplay();
    sendJson(res, result.ok ? 200 : 503, result);
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, platform: process.platform, sessionType: sessionType() });
    return;
  }

  sendJson(res, 404, { ok: false, reason: 'Not found' });
});

server.listen(PORT, HOST, () => {
  console.log(`Night Sound Machine Linux display helper listening on http://${HOST}:${PORT}`);
});

server.on('error', (error) => {
  console.error(`Night Sound Machine Linux display helper failed: ${error.message}`);
  process.exitCode = 1;
});