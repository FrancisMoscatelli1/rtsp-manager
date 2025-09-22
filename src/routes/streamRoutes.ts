import { Router, Request, Response } from 'express';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { StreamService } from '../steamService';
import { StreamPersistenceService } from '../services/streamPersistenceService';
import { StreamConfiguration } from '../models/streamState';
import config from '../config/config';

const router = Router();
const persistenceService = StreamPersistenceService.getInstance();

/**
 * GET /api/streams - Obtener todos los streams
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const streams = persistenceService.getAllStreams();
        res.json({
            success: true,
            data: streams,
            count: streams.length
        });
        return;
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving streams',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return;
    }
});

/**
 * GET /api/streams/:cameraId - Obtener un stream específico
 */
router.get('/:cameraId', async (req: Request, res: Response) => {
    try {
        const cameraId = req.params.cameraId;
        if (!uuidValidate(cameraId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid camera ID format (must be UUID)'
            });
        }

        const stream = persistenceService.getStream(cameraId);
        if (!stream) {
            return res.status(404).json({
                success: false,
                message: 'Stream not found'
            });
        }

        // Obtener información actualizada del stream activo
        const streamInfo = StreamService.getStreamInfo(cameraId);
        if (streamInfo) {
            stream.status.isActive = true;
            stream.status.uptime = streamInfo.uptime;
            stream.status.lastAccess = streamInfo.lastAccess.toISOString();
        }

        // Generar URLs de streaming si el stream está activo
        let streamingUrls = null;
        if (stream.status.isActive) {
            streamingUrls = {
                rtmp: `${config.rtmpBaseUrl}/camera_${cameraId}`,
                hls: `/hls/camera_${cameraId}/index.m3u8`,
                dash: `/dash/camera_${cameraId}/index.mpd`
            };
        }

        res.json({
            success: true,
            data: {
                ...stream,
                urls: streamingUrls
            }
        });
        return;
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving stream',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return;
    }
});

/**
 * POST /api/streams - Crear o actualizar un stream
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const {
            cameraId: providedCameraId,
            name,
            rtspUrl
        } = req.body;

        // Generar UUID si no se proporciona o validar el existente
        let cameraId: string;
        if (providedCameraId) {
            if (!uuidValidate(providedCameraId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid camera ID format (must be UUID)'
                });
            }
            cameraId = providedCameraId;
        } else {
            cameraId = uuidv4();
        }

        // Validaciones
        if (!name || !rtspUrl) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: name, rtspUrl'
            });
        }

        // Validar URL RTSP
        try {
            const urlObj = new URL(rtspUrl);
            if (urlObj.protocol !== 'rtsp:') {
                throw new Error('Invalid protocol');
            }
        } catch {
            return res.status(400).json({
                success: false,
                message: 'Invalid RTSP URL format'
            });
        }

        const streamConfig: Omit<StreamConfiguration, 'created' | 'lastModified'> = {
            cameraId,
            name,
            rtspUrl
        };

        const streamState = await persistenceService.addOrUpdateStream(streamConfig);

        // Auto-iniciar el stream automáticamente
        try {
            console.log(`Auto-starting stream: ${name}`);
            const startResult = await StreamService.startDashStream(cameraId, rtspUrl);
            
            if (startResult.success) {
                console.log(`✅ Stream auto-started successfully: ${name}`);
            } else {
                console.warn(`⚠️ Failed to auto-start stream: ${name} - ${startResult.message}`);
            }
        } catch (error) {
            console.error(`❌ Error auto-starting stream: ${name}`, error);
        }

        res.status(201).json({
            success: true,
            message: 'Stream configured and started automatically',
            data: streamState
        });
        return;
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error configuring stream',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return;
    }
});

/**
 * DELETE /api/streams/:cameraId - Eliminar un stream
 */
router.delete('/:cameraId', async (req: Request, res: Response) => {
    try {
        const cameraId = req.params.cameraId;
        if (!uuidValidate(cameraId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid camera ID format (must be UUID)'
            });
        }

        // Detener el stream si está activo (gestionado automáticamente)
        await StreamService.stopStream(cameraId);

        // Eliminar de la configuración
        const deleted = await persistenceService.deleteStream(cameraId);
        
        if (deleted) {
            res.json({
                success: true,
                message: 'Stream deleted successfully'
            });
            return;
        } else {
            res.status(404).json({
                success: false,
                message: 'Stream not found'
            });
            return;
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error deleting stream',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        return;
    }
});

export default router;