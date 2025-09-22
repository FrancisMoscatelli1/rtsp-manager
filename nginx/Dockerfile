FROM alpine:latest

# Instalar dependencias
RUN apk add --no-cache \
    nginx \
    nginx-mod-rtmp \
    ffmpeg

# Crear directorios necesarios
RUN mkdir -p /var/cache/nginx/client_temp \
    /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp \
    /var/cache/nginx/uwsgi_temp \
    /var/cache/nginx/scgi_temp \
    /tmp/dash \
    /tmp/hls \
    /usr/share/nginx/html \
    /var/log/nginx

# Crear usuario nginx si no existe
RUN addgroup -g 101 -S nginx || true
RUN adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx || true

EXPOSE 80 1935

CMD ["nginx", "-g", "daemon off;"]
