FROM node:22-alpine

WORKDIR /app

# Install dependencies needed for build
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build the frontend and backend
RUN npm run build

# Remove devDependencies to keep image size small
RUN npm prune --production

# Expose port (Cloud Run sets the PORT env var, typically to 8080)
EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]
