import { spawn, ChildProcess } from 'child_process';
import { streamManager } from './streamManager';
import { FFMPEG_PIPELINE, generateStreamUrls } from './config/steam';
import { StreamPersistenceService } from './services/streamPersistenceService';

interface StreamResult {
    success: boolean;
    message: string;
    urls?: ReturnType<typeof generateStreamUrls>;
    type?: 'dash' | 'existing';
    ready?: boolean;
}

export class StreamService {
    private static persistenceService = StreamPersistenceService.getInstance();

    /**
     * Inicializa el servicio y restaura streams configurados
     */
    static async initialize(): Promise<void> {
        await this.persistenceService.initialize();
        await this.restoreStreamsOnStartup();
    }

    /**
     * Restaura streams que deberían estar activos al iniciar
     */
    private static async restoreStreamsOnStartup(): Promise<void> {
        try {
            const streamsToStart = this.persistenceService.getStreamsToStart();
            console.log(`Found ${streamsToStart.length} enabled streams to start`);

            for (const streamState of streamsToStart) {
                try {
                    console.log(`Starting stream for camera ${streamState.configuration.cameraId} (${streamState.configuration.name})`);
                    const result = await this.startDashStream(
                        streamState.configuration.cameraId,
                        streamState.configuration.rtspUrl
                    );

                    if (result.success) {
                        console.log(`✅ Successfully started stream for camera ${streamState.configuration.cameraId}`);
                    } else {
                        console.warn(`❌ Failed to start stream for camera ${streamState.configuration.cameraId}: ${result.message}`);
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    console.error(`❌ Error starting stream for camera ${streamState.configuration.cameraId}:`, errorMessage);
                    await this.persistenceService.recordStreamError(streamState.configuration.cameraId, errorMessage);
                }
            }
        } catch (error) {
            console.error('Error during stream startup:', error);
        }
    }

    /**
     * Inicia un stream DASH para una cámara específica
     */
    static async startDashStream(cameraId: string, rtspUrl: string): Promise<StreamResult> {
        try {
            // Verificar si ya hay un stream activo
            if (streamManager.isStreamActive(cameraId)) {
                streamManager.updateLastAccess(cameraId);
                
                // Actualizar último acceso en persistencia
                try {
                    await this.persistenceService.updateLastAccess(cameraId);
                } catch (persistenceError) {
                    console.warn('Failed to update last access in persistence:', persistenceError);
                }

                return {
                    success: true,
                    type: 'existing',
                    message: 'Stream already active',
                    urls: generateStreamUrls(cameraId)
                };
            }

            // Validar URL RTSP
            if (!StreamService.isValidRtspUrl(rtspUrl)) {
                const errorMessage = 'Invalid RTSP URL format';
                try {
                    await this.persistenceService.recordStreamError(cameraId, errorMessage);
                } catch (persistenceError) {
                    console.warn('Failed to record error in persistence:', persistenceError);
                }
                return {
                    success: false,
                    message: errorMessage
                };
            }

            const urls = generateStreamUrls(cameraId);
            const ffmpegProcess = StreamService.createFFmpegProcess(rtspUrl, urls.rtmp);

            if (!ffmpegProcess) {
                const errorMessage = 'Failed to create FFmpeg process';
                try {
                    await this.persistenceService.recordStreamError(cameraId, errorMessage);
                } catch (persistenceError) {
                    console.warn('Failed to record error in persistence:', persistenceError);
                }
                return {
                    success: false,
                    message: errorMessage
                };
            }

            streamManager.addStream(cameraId, ffmpegProcess);

            // Marcar como activo en persistencia
            try {
                await this.persistenceService.markStreamActive(cameraId);
            } catch (persistenceError) {
                console.warn('Failed to mark stream as active in persistence:', persistenceError);
            }

            console.log(`DASH stream started for camera ${cameraId}`);
            console.log(`Source: ${rtspUrl} → Target: ${urls.rtmp}`);

            return {
                success: true,
                type: 'dash',
                message: 'DASH stream ready for playback',
                urls,
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Error starting DASH stream for camera ${cameraId}:`, error);
            
            // Registrar error en persistencia
            try {
                await this.persistenceService.recordStreamError(cameraId, errorMessage);
            } catch (persistenceError) {
                console.warn('Failed to record error in persistence:', persistenceError);
            }

            return {
                success: false,
                message: `Failed to start DASH stream: ${errorMessage}`
            };
        }
    }

    /**
     * Crea el proceso FFmpeg para conversión RTSP->RTMP
     */
    private static createFFmpegProcess(rtspUrl: string, rtmpUrl: string): ChildProcess | null {
        try {
            const args = FFMPEG_PIPELINE(rtspUrl, rtmpUrl);

            // Log del comando completo para debugging
            console.log('FFmpeg command:', 'ffmpeg', args.join(' '));
            console.log('RTSP Source:', rtspUrl);
            console.log('RTMP Target:', rtmpUrl);

            const gst = spawn('ffmpeg', args);

            // Configurar handlers de eventos
            StreamService.setupGStreamerHandlers(gst);

            return gst;
        } catch (error) {
            console.error('Failed to spawn GStreamer process:', error);
            return null;
        }
    }

    /**
     * Configura los event handlers para el proceso GStreamer
     */
    private static setupGStreamerHandlers(gst: ChildProcess): void {
        gst.stderr?.on('data', (data) => {
            const message = data.toString();
            // Mostrar TODOS los mensajes para debugging
            console.log(`FFmpeg: ${message.trim()}`);
        });

        gst.stdout?.on('data', (data) => {
            const message = data.toString();
            console.log(`FFmpeg stdout: ${message.trim()}`);
        });

        gst.on('spawn', () => {
            console.log('FFmpeg process spawned successfully');
        });

        gst.on('close', (code) => {
            console.log(`FFmpeg process closed with code: ${code}`);
        });

        gst.on('error', (error) => {
            console.error('FFmpeg process error:', error);
        });

        // Los eventos de close y error son manejados por StreamManager
    }

    /**
     * Valida formato de URL RTSP
     */
    private static isValidRtspUrl(url: string): boolean {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'rtsp:' && urlObj.hostname.length > 0;
        } catch {
            return false;
        }
    }

    /**
     * Detiene un stream específico
     */
    static async stopStream(cameraId: string): Promise<boolean> {
        return streamManager.removeStream(cameraId);
    }

    /**
     * Obtiene información de un stream activo
     */
    static getStreamInfo(cameraId: string) {
        const streamInfo = streamManager.getStreamInfo(cameraId);
        if (!streamInfo) return null;

        return {
            cameraId,
            isActive: true,
            startTime: streamInfo.startTime,
            lastAccess: streamInfo.lastAccess,
            uptime: Date.now() - streamInfo.startTime.getTime(),
            urls: generateStreamUrls(cameraId)
        };
    }
}