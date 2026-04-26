# ─── Stage 1 : Build React/Vite ──────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

# Installer dépendances
RUN npm install

# Copier le code source
COPY . .

# Build production
RUN npm run build


# ─── Stage 2 : Serve Nginx ───────────────────────────────
FROM nginx:alpine

# Copier build
COPY --from=builder /app/dist /usr/share/nginx/html

# Copier config nginx (SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
