import { ChildProcess } from 'child_process';
import { StreamPersistenceService } from './services/streamPersistenceService';
import { StreamService } from './steamService';

interface ActiveStream {
  cameraId: string; // UUID
  process: ChildProcess;
  startTime: Date;
  lastAccess: Date;
}

class StreamManager {
  private activeStreams: Map<string, ActiveStream> = new Map(); // UUID keys
  private persistenceService = StreamPersistenceService.getInstance();

  async addStream(cameraId: string, process: ChildProcess): Promise<void> {
    // Cerrar stream existente si existe
    await this.removeStream(cameraId);
    console.log(`Starting stream for camera ${cameraId}...`);
    if (process.pid) {
      console.log(`✅ Camera stream started successfully (${cameraId})`);
      // El proceso ya está spawneado
      this.activeStreams.set(cameraId, {
        cameraId,
        process,
        startTime: new Date(),
        lastAccess: new Date()
      });
    } else {
      process.on('spawn', () => {
        console.log(`✅ Camera stream started successfully (${cameraId})`);
        this.activeStreams.set(cameraId, {
          cameraId,
          process,
          startTime: new Date(),
          lastAccess: new Date()
        });
      });
    }

    process.stdout?.on('data', (data) => {
      const message = data.toString();
      console.log(`Camera (${cameraId}) stdout: ${message.trim()}`);
    });

    process.stderr?.on('data', (data) => {
      const message = data.toString();
      // Mostrar TODOS los mensajes para debugging
      console.log(`Camera (${cameraId}) stderr: ${message.trim()}`);
      const error = new Error(message ? message.trim() : 'Unknown error');
      this.handleStreamError(cameraId, error);
    });

    process.on('error', (error) => {
      console.error(`❌ Stream process for camera ${cameraId} error:`, error);
      this.handleStreamError(cameraId, error);
    });

    process.on('close', (code) => {
      console.log(`❌ Stream process for camera ${cameraId} closed with code: ${code}`);
      this.handleStreamTermination(cameraId, code);
    });
  }

  async removeStream(cameraId: string): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      const stream = this.activeStreams.get(cameraId);
      if (!stream) return resolve(true);

      if (!stream.process.killed) {
        try {
          stream.process.once('close', () => resolve(true));
          stream.process.kill('SIGINT');
        } catch (error) {
          console.warn(`Failed to kill process for ${cameraId}:`, error);
          resolve(true);
        }
      } else {
        resolve(true);
      }
    });
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

  async closeAllStreams(): Promise<void> {
    console.log('Closing all active streams...');
    const cameraIds = Array.from(this.activeStreams.keys());
    const promises = cameraIds.map(cameraId => this.removeStream(cameraId));
    await Promise.all(promises);
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
      this.activeStreams.delete(cameraId);
      if (code !== null) {
        // Si el proceso terminó con error, registrarlo
        await this.persistenceService.recordStreamError(
          cameraId,
          `Stream process terminated with code: ${code}`
        );

        // Retry infinito cada 5 segundos
        const retryStart = async () => {
          const stream = this.persistenceService.getStream(cameraId);
          if (stream) {
            const result = await StreamService.startDashStream(stream.configuration.cameraId, stream.configuration.rtspUrl);
            if (!result.success) {
              console.warn(`⚠️ Retry to start stream ${cameraId} failed: ${result.message}`);
              // Si falla, volver a intentar en 5 segundos
              setTimeout(retryStart, 5000);
            }
          } else {
            console.warn(`⚠️ Retry to start stream ${cameraId} failed: No stream configuration found`);
          }
        };
        setTimeout(retryStart, 5000);
      }
    } catch (error) {
      console.error('Error handling stream termination:', error);
    }
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
  }
}

// Singleton instance
export const streamManager = new StreamManager();

// Cleanup al cerrar la aplicación
process.on('SIGINT', async () => {
  await streamManager.closeAllStreams();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await streamManager.closeAllStreams();
  process.exit(0);
});