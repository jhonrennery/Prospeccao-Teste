FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache git

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
