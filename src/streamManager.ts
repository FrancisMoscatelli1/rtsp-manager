import { ChildProcess } from 'child_process';
import { StreamPersistenceService } from './services/streamPersistenceService';

interface ActiveStream {
  cameraId: string; // UUID
  process: ChildProcess;
  startTime: Date;
  lastAccess: Date;
}

class StreamManager {
  private activeStreams: Map<string, ActiveStream> = new Map(); // UUID keys
  private persistenceService = StreamPersistenceService.getInstance();

  addStream(cameraId: string, process: ChildProcess): void {
    // Cerrar stream existente si existe
    this.removeStream(cameraId);

    const streamInfo: ActiveStream = {
      cameraId,
      process,
      startTime: new Date(),
      lastAccess: new Date()
    };

    this.activeStreams.set(cameraId, streamInfo);

    // Cleanup cuando el proceso termina
    process.on('close', (code) => {
      console.log(`Stream process for camera ${cameraId} closed with code: ${code}`);
      this.handleStreamTermination(cameraId, code);
    });

    process.on('error', (error) => {
      console.error(`Stream process for camera ${cameraId} error:`, error);
      this.handleStreamError(cameraId, error);
    });

    console.log(`Stream started for camera ${cameraId}`);
  }

  removeStream(cameraId: string): boolean {
    const stream = this.activeStreams.get(cameraId);
    if (stream) {
      if (!stream.process.killed) {
        stream.process.kill('SIGINT');
      }
      
      this.activeStreams.delete(cameraId);
      console.log(`Stream removed for camera ${cameraId}`);
      return true;
    }
    return false;
  }

  updateLastAccess(cameraId: string): void {
    const stream = this.activeStreams.get(cameraId);
    if (stream) {
      stream.lastAccess = new Date();
      
      // Actualizar en persistencia de forma asíncrona sin bloquear
      this.persistenceService.updateLastAccess(cameraId).catch(error => {
        console.warn('Failed to update last access in persistence:', error);
      });
    }
  }

  isStreamActive(cameraId: string): boolean {
    return this.activeStreams.has(cameraId);
  }

  getActiveStreams(): string[] {
    return Array.from(this.activeStreams.keys());
  }

  closeAllStreams(): void {
    console.log('Closing all active streams...');
    for (const cameraId of this.activeStreams.keys()) {
      this.removeStream(cameraId);
    }
  }

  getStreamInfo(cameraId: string): ActiveStream | undefined {
    return this.activeStreams.get(cameraId);
  }

  /**
   * Maneja la terminación de un proceso de stream
   */
  private async handleStreamTermination(cameraId: string, code: number | null): Promise<void> {
    try {
      // Marcar como inactivo en persistencia
      await this.persistenceService.markStreamInactive(cameraId);
      
      if (code !== 0 && code !== null) {
        // Si el proceso terminó con error, registrarlo
        await this.persistenceService.recordStreamError(
          cameraId, 
          `Stream process terminated with code: ${code}`
        );
      }
    } catch (error) {
      console.error('Error handling stream termination:', error);
    }
    
    // Remover del manager
    this.removeStream(cameraId);
  }

  /**
   * Maneja errores de procesos de stream
   */
  private async handleStreamError(cameraId: string, error: Error): Promise<void> {
    try {
      // Registrar error en persistencia
      await this.persistenceService.recordStreamError(cameraId, error.message);
      // Marcar como inactivo
      await this.persistenceService.markStreamInactive(cameraId);
    } catch (persistenceError) {
      console.error('Error handling stream error in persistence:', persistenceError);
    }
    
    // Remover del manager
    this.removeStream(cameraId);
  }
}

// Singleton instance
export const streamManager = new StreamManager();

// Cleanup al cerrar la aplicación
process.on('SIGINT', () => {
  streamManager.closeAllStreams();
  process.exit(0);
});

process.on('SIGTERM', () => {
  streamManager.closeAllStreams();
  process.exit(0);
});