FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

FROM base AS dependencies
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/
COPY packages/database/package.json ./packages/database/
COPY apps/bot/package.json ./apps/bot/
COPY apps/api/package.json ./apps/api/
COPY apps/dashboard/package.json ./apps/dashboard/
RUN npm install

FROM dependencies AS build
COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/ ./apps/
RUN npm run db:generate
RUN npm run build

FROM base AS runner
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps ./apps
COPY --from=build /app/package.json ./
EXPOSE 4000
CMD ["sh", "-c", "npm run start:api & npm run start:bot"]
