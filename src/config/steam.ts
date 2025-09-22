import config from './config'

export const FFMPEG_PIPELINE = (rtspUrl: string, rtmpUrl: string) => [
    '-xerror', '-fflags', 'nobuffer',
    '-loglevel', 'error',      // Solo mostrar errores
    '-nostats',                // No mostrar estadísticas de progreso
    '-rtsp_transport', 'tcp',
    '-re',
    '-i', rtspUrl,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-b:v', '1500k',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-c', 'copy',
    '-f', 'flv',
    rtmpUrl
]


export const generateStreamUrls = (cameraId: string) => ({
  rtmp: `${config.rtmpBaseUrl}/camera_${cameraId}`,
  hls: `/hls/camera_${cameraId}/index.m3u8`,
  dash: `/dash/camera_${cameraId}/index.mpd`
});