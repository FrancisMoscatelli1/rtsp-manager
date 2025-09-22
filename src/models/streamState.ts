export interface StreamConfiguration {
    cameraId: string; // UUID
    name: string;
    rtspUrl: string;
    created: string;
    lastModified: string;
}

export interface StreamStatus {
    cameraId: string; // UUID
    isActive: boolean;
    startTime?: string;
    lastAccess?: string;
    uptime?: number;
    errorCount: number;
    lastError?: string;
    lastErrorTime?: string;
}

export interface StreamState {
    configuration: StreamConfiguration;
    status: StreamStatus;
}

export interface StreamsData {
    version: string;
    lastUpdated: string;
    streams: Record<string, StreamState>; // UUID keys
}

export const DEFAULT_STREAMS_DATA: StreamsData = {
    version: "1.0.0",
    lastUpdated: new Date().toISOString(),
    streams: {}
};