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

  async addStream(cameraId: string, process: ChildProcess): Promise<void> {
    // Cerrar stream existente si existe
    await this.removeStream(cameraId);

    process.on('spawn', () => {
      console.log(`✅ Camera stream started successfully (${cameraId})`);
      this.activeStreams.set(cameraId, {
        cameraId,
        process,
        startTime: new Date(),
        lastAccess: new Date()
      });
    });

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
      //       // await StreamService.stopStream(cameraId);
      //       // setTimeout(() => {
      //       //     StreamService.startDashStream(cameraId, rtspUrl);
      //       // }, 2000); // Espera 2 segundos antes de reiniciar
    });
  }

  removeStream(cameraId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const stream = this.activeStreams.get(cameraId);
      if (!stream) {
        resolve(false);
        return;
      }

      if (stream.process.killed) {
        // Ya está muerto, solo limpiamos
        this.activeStreams.delete(cameraId);
        console.log(`Stream removed for camera ${cameraId} (already killed)`);
        resolve(true);
        return;
      }

      // Configurar listener para cuando termine el proceso
      const onClose = (code: number | null) => {
        this.activeStreams.delete(cameraId);
        console.log(`Stream removed for camera ${cameraId} (terminated with code: ${code})`);
        resolve(true);
      };

      // Agregar listener temporal para este cierre específico
      stream.process.once('close', onClose);

      // Matar el proceso
      try {
        stream.process.kill('SIGINT');
      } catch (error) {
        console.warn(`Failed to kill process for ${cameraId}:`, error);
        // Si falla matarlo, limpiamos de todos modos
        stream.process.removeListener('close', onClose);
        this.activeStreams.delete(cameraId);
        resolve(true);
      }

      // Timeout de seguridad en caso de que el proceso no termine
      setTimeout(() => {
        if (this.activeStreams.has(cameraId)) {
          console.warn(`Force removing stream ${cameraId} after timeout`);
          stream.process.removeListener('close', onClose);
          try {
            stream.process.kill('SIGKILL');
          } catch (e) {
            console.warn(`Failed to force kill process for ${cameraId}:`, e);
          }
          this.activeStreams.delete(cameraId);
          resolve(true);
        }
      }, 5000); // 5 segundos timeout
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

    // Solo limpiar del manager, no matar el proceso (ya terminó)
    this.activeStreams.delete(cameraId);
    console.log(`Stream cleaned up for camera ${cameraId}`);
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

    // Solo limpiar del manager, el proceso probablemente ya murió
    this.activeStreams.delete(cameraId);
    console.log(`Stream cleaned up after error for camera ${cameraId}`);
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