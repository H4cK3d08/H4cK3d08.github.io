import express from 'express';
import { exec } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3000;

function formatBytes(bytes) {
  if (!bytes) return null;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

app.get('/api/video/download', (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.json({
      status: 'error',
      message: 'No URL provided'
    });
  }

  const cmd = `yt-dlp -J "${videoUrl}"`;

  exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (err, stdout) => {
    if (err) {
      return res.json({
        status: 'error',
        message: err.message
      });
    }

    try {
      const data = JSON.parse(stdout);
      const formats = data.formats || [];

      const videoFormats = formats
        .filter(f => f.vcodec !== 'none')
        .sort((a, b) => (b.height || 0) - (a.height || 0));

      const audioFormats = formats
        .filter(f => f.acodec !== 'none' && f.vcodec === 'none')
        .sort((a, b) => (b.abr || 0) - (a.abr || 0));

      const bestAudio = audioFormats[0] || null;

      const qualities = videoFormats.map(f => ({
        format_id: f.format_id,
        quality: f.format_note || (f.height ? `${f.height}p` : 'unknown'),
        ext: f.ext,
        filesize: formatBytes(f.filesize),
        url: f.url,
        audio: f.acodec !== 'none',
        type:
          f.acodec !== 'none'
            ? 'muxed'
            : 'video-only',
        fps: f.fps || null,
        mime: f.ext,
        audio_url: f.acodec === 'none' && bestAudio ? bestAudio.url : null
      }));

      res.json({
        status: 'success',
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        bestAudio: bestAudio
          ? {
              format_id: bestAudio.format_id,
              ext: bestAudio.ext,
              bitrate: bestAudio.abr,
              url: bestAudio.url
            }
          : null,
        qualities
      });

    } catch (e) {
      res.json({
        status: 'error',
        message: 'JSON parse failed'
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
