# Daily Recall
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
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── 运行镜像 ─────────────────────────────────────────────
# 用 Node 而不是 nginx：加了账号与反馈之后必须有服务端进程。
# （想要纯静态版本请用 v1.0.0 tag，那里是 nginx + out/）
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# 题库：静态模式下会给前端直接读，服务端模式下留给后台导出清单用
COPY --from=builder --chown=nextjs:nodejs /app/questions ./questions

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
