FROM denoland/deno:latest

ARG GIT_REVISION
ENV DENO_DEPLOYMENT_ID=${GIT_REVISION}

WORKDIR /app

# Copy the entire project
COPY . .

# Build the Fresh playground
WORKDIR /app/playground/fresh

# Install dependencies (creates node_modules for Tailwind)
RUN deno install

# Build Fresh app
RUN deno task build

# Cache the built server
RUN deno cache _fresh/server.js

EXPOSE 8000

# Use deno serve for Fresh 2.2.0
CMD ["serve", "-A", "--port=8000", "_fresh/server.js"]
