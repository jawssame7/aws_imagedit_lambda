FROM public.ecr.aws/lambda/nodejs:20

# Set the working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Install necessary dependencies
RUN dnf update -y && \
    dnf install -y \
        fontconfig \
        freetype \
    && \
    dnf clean all && \
    rm -rf /var/cache/dnf

# Copy font files
COPY fonts/ ${LAMBDA_TASK_ROOT}/fonts/
# Update the font cache
RUN fc-cache -fv

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy application code (TypeScript source)
COPY tsconfig.json ./
COPY app.ts ./

# Build TypeScript to JavaScript
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --omit=dev

# Set the handler
CMD [ "dist/app.lambdaHandler" ] 