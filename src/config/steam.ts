import config from './config'

export const FFMPEG_PIPELINE = (rtspUrl: string, rtmpUrl: string) => [
    '-xerror', '-fflags', 'nobuffer', // Terminar en error si hay un problema
    '-loglevel', 'error',      // Solo mostrar errores
    '-nostats',                // No mostrar estadísticas de progreso
    '-rtsp_transport', 'tcp',  // Usar TCP para RTSP
    '-i', rtspUrl, // Input RTSP URL
    '-c', 'copy', // Copiar códec sin recodificar
    '-f', 'flv', // Formato de salida FLV
    rtmpUrl // Output RTMP URL
]


export const generateStreamUrls = (cameraId: string) => ({
  rtmp: `${config.rtmpBaseUrl}/camera_${cameraId}`,
  hls: `/hls/camera_${cameraId}/index.m3u8`,
  dash: `/dash/camera_${cameraId}/index.mpd`
});