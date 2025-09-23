# RTSP Stream Manager

Sistema de administración de streams RTSP con persistencia en JSON y API REST.

## Características

- ✅ Gestión de streams RTSP a través de API REST
- ✅ Persistencia de configuración en archivo JSON
- ✅ Auto-start automático de todos los streams al iniciar la aplicación
- ✅ Manejo de errores y logging
- ✅ Monitoreo de estado de streams
- ✅ Gestión automática sin configuración manual adicional

## Instalación

```bash
npm install
```

## Configuración

Crear un archivo `.env` con las siguientes variables:

```env
EXPRESS_PORT=5000
STREAM_RTMP_BASE_URL=rtmp://localhost:1935/live
```

## Uso

### Iniciar el servidor

```bash
# Desarrollo
npm run dev

# Producción
npm run build
npm start
```

### API Endpoints

#### 1. Listar todos los streams
```http
GET /streams
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    {
      "configuration": {
        "cameraId": "550e8400-e29b-41d4-a716-446655440001",
        "name": "Cámara Principal",
        "rtspUrl": "rtsp://192.168.1.100:554/stream",
        "created": "2024-01-01T00:00:00.000Z",
        "lastModified": "2024-01-01T00:00:00.000Z"
      },
      "status": {
        "cameraId": "550e8400-e29b-41d4-a716-446655440001",
        "isActive": true,
        "startTime": "2024-01-01T01:00:00.000Z",
        "lastAccess": "2024-01-01T01:05:00.000Z",
        "uptime": 300000,
        "errorCount": 0
      }
    }
  ],
  "count": 1
}
```

#### 2. Crear/Actualizar un stream
```http
POST /streams
Content-Type: application/json

{
  "name": "Cámara Principal",
  "rtspUrl": "rtsp://192.168.1.100:554/stream"
}
```

**Nota:** El `cameraId` (UUID) se genera automáticamente si no se proporciona. Si quieres usar un UUID específico, inclúyelo en el cuerpo de la petición:

```json
{
  "cameraId": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Cámara Principal",
  "rtspUrl": "rtsp://192.168.1.100:554/stream"
}
```

#### 3. Obtener un stream específico
```http
GET /streams/550e8400-e29b-41d4-a716-446655440001
```

#### 4. Eliminar un stream
```http
DELETE /streams/550e8400-e29b-41d4-a716-446655440001
```

**Nota:** Al eliminar un stream, se detiene automáticamente si está activo.

## Estructura de archivos

```
src/
├── config/
│   ├── config.ts         # Configuración general
│   └── steam.ts          # Configuración FFmpeg
├── models/
│   └── streamState.ts    # Modelos de datos
├── routes/
│   └── streamRoutes.ts   # Rutas de la API
├── services/
│   └── streamPersistenceService.ts  # Servicio de persistencia
├── index.ts              # Servidor principal
├── steamService.ts       # Servicio de streams
└── streamManager.ts      # Gestor de procesos
```

## Persistencia

Los datos se almacenan en `data/streams.json` con la siguiente estructura:

```json
{
  "version": "1.0.0",
  "lastUpdated": "2024-01-01T00:00:00.000Z",
  "streams": {
    "550e8400-e29b-41d4-a716-446655440001": {
      "configuration": {
        "cameraId": "550e8400-e29b-41d4-a716-446655440001",
        "name": "Cámara Principal",
        "rtspUrl": "rtsp://192.168.1.100:554/stream",
        "created": "2024-01-01T00:00:00.000Z",
        "lastModified": "2024-01-01T00:00:00.000Z"
      },
      "status": {
        "cameraId": "550e8400-e29b-41d4-a716-446655440001",
        "isActive": false,
        "errorCount": 0
      }
    }
  }
}
```

## Gestión automática

Al cargar un stream en el sistema, automáticamente:
- Se inicia al momento de la creación
- Se gestiona sin necesidad de configuración adicional
- Permanece activo mientras la aplicación esté corriendo
- Al reiniciar la aplicación, todos los streams configurados se inician automáticamente

## Manejo de errores

- Los errores se registran en el estado del stream
- Se lleva un contador de errores por stream
- Los errores se persisten en el archivo JSON
- Los streams se reinician automáticamente tras errores cuando sea posible

## Monitoreo

- Cada stream registra su tiempo de actividad
- Se actualiza el último acceso cuando se consulta un stream activo
- Los streams permanecen activos de forma continua sin timeouts automáticos

## Comandos útiles

```bash
# Ver logs en tiempo real
npm run dev

# Compilar para producción
npm run build
```

## Requisitos del sistema

- Node.js 16+
- FFmpeg instalado y disponible en PATH
- Servidor RTMP (opcional, para streaming)

## Troubleshooting

### Stream no inicia automáticamente
1. Verificar que la URL RTSP sea válida y accesible
2. Revisar que FFmpeg esté instalado
3. Verificar la configuración del servidor RTMP
4. Consultar los logs del stream en el archivo JSON

### Gestión automática no funciona
1. Revisar los logs de la aplicación
2. Verificar que el archivo `data/streams.json` sea accesible
3. Comprobar que las URLs RTSP sean válidas y accesibles

### Errores de persistencia
1. Verificar permisos de escritura en el directorio `data/`
2. Verificar espacio disponible en disco
3. Revisar que el archivo JSON no esté corrupto