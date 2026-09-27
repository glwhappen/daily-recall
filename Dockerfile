# Daily Recall — 静态站镜像
# 构建：docker build -t daily-recall .
# 国内加速：docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com .
ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS builder
WORKDIR /app

ARG NPM_REGISTRY=
RUN if [ -n "$NPM_REGISTRY" ]; then \
      npm config set registry "$NPM_REGISTRY" && npm config set replace-registry-host always; \
    fi

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
# 纯静态导出：产物在 /app/out，不需要 Node 运行时
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/out /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
