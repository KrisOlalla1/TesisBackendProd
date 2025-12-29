# Dockerfile para Backend - Sistema de Monitoreo Médico
# Optimizado para Google Cloud Run

FROM node:18-alpine

# Crear directorio de la app
WORKDIR /app

# Copiar archivos de dependencias primero (para aprovechar cache de Docker)
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --only=production

# Copiar el resto del código fuente
COPY src ./src

# Cloud Run usa el puerto 8080 por defecto
ENV PORT=8080

# Exponer el puerto
EXPOSE 8080

# Comando para iniciar la aplicación
CMD ["node", "src/app.js"]
