# Omnium Streaming Server

Self-hosted RTMP → HLS streaming for the Omnium stream page.

## Quick Start

### 1. Start the server

```bash
docker-compose up -d
```

This starts mediamtx, which accepts RTMP streams and serves them as HLS.

### 2. Configure OBS

Open OBS Studio and go to **Settings → Stream**:

| Setting | Value |
|---------|-------|
| Service | Custom... |
| Server | `rtmp://localhost:1935/live` |
| Stream Key | `omnium` |

### 3. Start streaming

Click "Start Streaming" in OBS. Your stream is now available at:

- **HLS**: `http://localhost:8888/live/omnium/index.m3u8`
- **WebRTC**: `http://localhost:8889/live/omnium` (lower latency)

### 4. Open the stream page

Navigate to `http://localhost:3000/stream` - the player will automatically connect.

## Production Deployment

### Server Requirements

- Docker and Docker Compose
- Public IP or domain
- Open ports: 1935 (RTMP), 8888 (HLS), 8889 (WebRTC)

### Deploy

```bash
# On your server
git clone <repo>
cd streaming
docker-compose up -d
```

### Configure the website

Create `.env.local` in the website directory:

```env
NEXT_PUBLIC_STREAM_HLS_URL=https://your-server.com:8888/live/omnium/index.m3u8
NEXT_PUBLIC_STREAM_WEBRTC_URL=https://your-server.com:8889/live/omnium
```

### OBS Remote Streaming

Update OBS settings to point to your server:

| Setting | Value |
|---------|-------|
| Server | `rtmp://your-server.com:1935/live` |
| Stream Key | `omnium` |

## Ports Reference

| Port | Protocol | Purpose |
|------|----------|---------|
| 1935 | RTMP | OBS ingest |
| 8888 | HTTP | HLS playback |
| 8889 | HTTP/WS | WebRTC playback |
| 8554 | RTSP | Optional RTSP access |

## Troubleshooting

### Stream not appearing

1. Check OBS is connected (green square in bottom bar)
2. Verify mediamtx is running: `docker-compose logs -f`
3. Test HLS URL directly in browser/VLC

### High latency

- HLS has ~3-6 second latency by default
- For lower latency, use WebRTC playback (when implemented)
- Adjust `hlsSegmentDuration` in mediamtx.yml

### CORS issues

The config allows all origins (`hlsAllowOrigin: '*'`). For production, restrict to your domain.
