FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
RUN mkdir -p /app/uploads/original /app/uploads/thumbnail
EXPOSE 3000
CMD ["npm", "start"]
