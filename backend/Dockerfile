FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM build AS migrate
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
# sharp's image library ships as optional packages for each platform, which the
# install above leaves out. Copy the ones that were installed for this image.
COPY --from=build /app/node_modules/@img ./node_modules/@img
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
