import fs from 'fs/promises';
import path from 'path';
import { StreamsData, StreamConfiguration, StreamStatus, StreamState, DEFAULT_STREAMS_DATA } from '../models/streamState';

export class StreamPersistenceService {
    private static instance: StreamPersistenceService;
    private readonly dataFilePath: string;
    private streamsData: StreamsData;

    private constructor() {
        this.dataFilePath = path.join(process.cwd(), 'data', 'streams.json');
        this.streamsData = { ...DEFAULT_STREAMS_DATA };
    }

    static getInstance(): StreamPersistenceService {
        if (!StreamPersistenceService.instance) {
            StreamPersistenceService.instance = new StreamPersistenceService();
        }
        return StreamPersistenceService.instance;
    }

    /**
     * Inicializa el servicio y carga los datos desde el archivo
     */
    async initialize(): Promise<void> {
        try {
            // Crear directorio data si no existe
            const dataDir = path.dirname(this.dataFilePath);
            await fs.mkdir(dataDir, { recursive: true });

            // Intentar cargar datos existentes
            await this.loadFromFile();
            console.log('Stream persistence service initialized successfully');
        } catch (error) {
            console.warn('Could not load existing stream data, starting with empty state:', error);
            await this.saveToFile();
        }
    }

    /**
     * Carga los datos desde el archivo JSON
     */
    private async loadFromFile(): Promise<void> {
        try {
            const fileContent = await fs.readFile(this.dataFilePath, 'utf-8');
            this.streamsData = JSON.parse(fileContent);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                // Archivo no existe, usar datos por defecto
                this.streamsData = { ...DEFAULT_STREAMS_DATA };
            } else {
                throw error;
            }
        }
    }

    /**
     * Guarda los datos al archivo JSON
     */
    private async saveToFile(): Promise<void> {
        this.streamsData.lastUpdated = new Date().toISOString();
        const jsonData = JSON.stringify(this.streamsData, null, 2);
        await fs.writeFile(this.dataFilePath, jsonData, 'utf-8');
    }

    /**
     * Obtiene toda la configuración de streams
     */
    getAllStreams(): StreamState[] {
        return Object.values(this.streamsData.streams);
    }

    /**
     * Obtiene la configuración de un stream específico
     */
    getStream(cameraId: string): StreamState | null {
        return this.streamsData.streams[cameraId] || null;
    }

    /**
     * Agrega o actualiza un stream
     */
    async addOrUpdateStream(config: Omit<StreamConfiguration, 'created' | 'lastModified'>): Promise<StreamState> {
        const now = new Date().toISOString();
        const existingStream = this.streamsData.streams[config.cameraId];

        const streamConfig: StreamConfiguration = {
            ...config,
            created: existingStream?.configuration.created || now,
            lastModified: now
        };

        const streamStatus: StreamStatus = existingStream?.status || {
            cameraId: config.cameraId,
            isActive: false,
            errorCount: 0
        };

        const streamState: StreamState = {
            configuration: streamConfig,
            status: streamStatus
        };

        this.streamsData.streams[config.cameraId] = streamState;
        await this.saveToFile();

        return streamState;
    }

    /**
     * Elimina un stream
     */
    async deleteStream(cameraId: string): Promise<boolean> {
        if (!this.streamsData.streams[cameraId]) {
            return false;
        }

        delete this.streamsData.streams[cameraId];
        await this.saveToFile();
        return true;
    }

    /**
     * Actualiza el estado de un stream
     */
    async updateStreamStatus(cameraId: string, statusUpdate: Partial<StreamStatus>): Promise<void> {
        const stream = this.streamsData.streams[cameraId];
        if (!stream) {
            throw new Error(`Stream with cameraId ${cameraId} not found`);
        }

        stream.status = { ...stream.status, ...statusUpdate };
        await this.saveToFile();
    }

    /**
     * Marca un stream como activo
     */
    async markStreamActive(cameraId: string): Promise<void> {
        await this.updateStreamStatus(cameraId, {
            isActive: true,
            startTime: new Date().toISOString(),
            lastAccess: new Date().toISOString()
        });
    }

    /**
     * Marca un stream como inactivo
     */
    async markStreamInactive(cameraId: string): Promise<void> {
        await this.updateStreamStatus(cameraId, {
            isActive: false,
            startTime: undefined,
            lastAccess: undefined,
            uptime: undefined
        });
    }

    /**
     * Actualiza el último acceso de un stream
     */
    async updateLastAccess(cameraId: string): Promise<void> {
        const stream = this.streamsData.streams[cameraId];
        if (stream && stream.status.isActive) {
            const now = new Date().toISOString();
            const startTime = stream.status.startTime ? new Date(stream.status.startTime) : new Date();
            const uptime = Date.now() - startTime.getTime();

            await this.updateStreamStatus(cameraId, {
                lastAccess: now,
                uptime
            });
        }
    }

    /**
     * Registra un error para un stream
     */
    async recordStreamError(cameraId: string, error: string): Promise<void> {
        const stream = this.streamsData.streams[cameraId];
        if (stream) {
            await this.updateStreamStatus(cameraId, {
                errorCount: stream.status.errorCount + 1,
                lastError: error,
                lastErrorTime: new Date().toISOString()
            });
        }
    }

    /**
     * Obtiene streams que deberían estar activos (todos los streams)
     */
    getStreamsToStart(): StreamState[] {
        return Object.values(this.streamsData.streams);
    }

    /**
     * Resetea el contador de errores de un stream
     */
    async resetStreamErrors(cameraId: string): Promise<void> {
        await this.updateStreamStatus(cameraId, {
            errorCount: 0,
            lastError: undefined,
            lastErrorTime: undefined
        });
    }
}