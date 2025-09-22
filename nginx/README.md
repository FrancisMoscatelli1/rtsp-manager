# NGINX RTMP Docker con soporte DASH

Este proyecto configura un servidor NGINX con el módulo RTMP para streaming en vivo, con soporte para generar streams DASH y HLS.

## 🚀 Inicio Rápido

### Construir y ejecutar el contenedor:

```bash
docker-compose up -d --build
```

    sudo apt install libnginx-mod-rtmp


### Acceder a la interfaz web:
- **Reproductor web:** http://localhost
- **Estadísticas RTMP:** http://localhost/stat

## 📡 Configuración de Streaming

### Para OBS Studio:
- **Servidor:** `rtmp://localhost:1935/live/camara_x`
- **Clave de stream:** Cualquier nombre (ej: `test`, `camara_x`, etc.)

### Para FFmpeg:
```bash
ffmpeg -rtsp_transport tcp -re -i "rtsp://user:password@192.168.80.2:554/profile2" -c:v libx264 -preset veryfast -tune zerolatency -b:v 1500k -c:a aac -b:a 128k -ar 44100 -f flv "rtmp://localhost:1935/live/camara_x"
```

## 🎬 URLs de Reproducción

Una vez que inicies un stream con la clave `camara_x`, podrás acceder a:

### DASH (recomendado):
```
http://localhost/dash/camara_x/index.mpd
```

### HLS (alternativa):
```
http://localhost/hls/camara_x/index.m3u8
```

## 📋 Características

- ✅ **Streaming RTMP:** Puerto 1935
- ✅ **DASH streaming:** Generación automática de manifests MPD
- ✅ **HLS streaming:** Generación automática de playlists M3U8
- ✅ **CORS habilitado:** Acceso desde cualquier origen
- ✅ **Estadísticas en tiempo real:** Monitor del servidor RTMP
- ✅ **Auto-cleanup:** Limpieza automática de segmentos antiguos

## 🔧 Configuración Avanzada

### Modificar la configuración DASH:
Edita `nginx.conf` en la sección `application live`:

```nginx
# Configuración DASH
dash on;
dash_path /tmp/dash;
dash_fragment 3;          # Duración de fragmentos en segundos
dash_playlist_length 120; # Duración total del playlist en segundos
```

### Puertos personalizados:
Modifica `docker-compose.yml`:

```yaml
ports:
  - "1935:1935"  # Puerto RTMP
  - "80:80"     # Puerto HTTP
```

## 🛠️ Comandos útiles

### Ver logs del contenedor:
```bash
docker-compose logs -f
```

### Reiniciar el servicio:
```bash
docker-compose restart
```

### Detener el servicio:
```bash
docker-compose down
```

### Reconstruir completamente:
```bash
docker-compose down
docker-compose up -d --build --force-recreate
```

## 📊 Monitoreo

### Estadísticas RTMP:
Accede a `http://localhost/stat` para ver:
- Streams activos
- Número de espectadores
- Bitrate
- Tiempo de conexión

### Control RTMP:
Endpoint disponible en `http://localhost/control` para:
- Desconectar clientes
- Grabar streams
- Redirigir streams

## 🔍 Troubleshooting

### El stream no se genera:
1. Verifica que OBS esté configurado correctamente
2. Revisa los logs: `docker-compose logs nginx-rtmp`
3. Confirma que el puerto 1935 esté disponible

### Error de CORS:
La configuración incluye headers CORS permisivos. Si aún tienes problemas, verifica que el servidor esté ejecutándose en el puerto correcto.

### Latencia alta:
Ajusta los parámetros en `nginx.conf`:
```nginx
dash_fragment 1;  # Fragmentos más pequeños
```
