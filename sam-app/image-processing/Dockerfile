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

# Copy font files FIRST, so they exist when fc-cache runs
# Add a dummy ARG to attempt cache busting for the COPY step
ARG CACHEBUST=1
COPY fonts/ ${LAMBDA_TASK_ROOT}/fonts/

# Create font directories (redundant if COPY works, but safe), custom fontconfig, set permissions, and update cache in one layer
RUN mkdir -p /var/task/fonts && \
    mkdir -p /tmp/fontconfig && \
    chmod 777 /var/task/fonts && \
    chmod 777 /tmp/fontconfig && \
    echo '<?xml version="1.0"?>' > /etc/fonts/fonts.conf && \
    echo '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">' >> /etc/fonts/fonts.conf && \
    echo '<fontconfig>' >> /etc/fonts/fonts.conf && \
    echo '  <description>Custom Lambda font configuration</description>' >> /etc/fonts/fonts.conf && \
    echo '  <dir>/var/task/fonts</dir>' >> /etc/fonts/fonts.conf && \
    echo '  <cachedir>/tmp/fontconfig</cachedir>' >> /etc/fonts/fonts.conf && \
    echo '  <match target="pattern">' >> /etc/fonts/fonts.conf && \
    echo '    <test qual="any" name="family"><string>NotoSansJP</string></test>' >> /etc/fonts/fonts.conf && \
    echo '    <edit name="family" mode="assign" binding="same"><string>Noto Sans JP</string></edit>' >> /etc/fonts/fonts.conf && \
    echo '  </match>' >> /etc/fonts/fonts.conf && \
    echo '  <match target="font">' >> /etc/fonts/fonts.conf && \
    echo '    <edit name="antialias" mode="assign"><bool>true</bool></edit>' >> /etc/fonts/fonts.conf && \
    echo '    <edit name="hinting" mode="assign"><bool>true</bool></edit>' >> /etc/fonts/fonts.conf && \
    echo '    <edit name="hintstyle" mode="assign"><const>hintslight</const></edit>' >> /etc/fonts/fonts.conf && \
    echo '    <edit name="rgba" mode="assign"><const>rgb</const></edit>' >> /etc/fonts/fonts.conf && \
    echo '  </match>' >> /etc/fonts/fonts.conf && \
    echo '  <config><rescan><int>30</int></rescan></config>' >> /etc/fonts/fonts.conf && \
    echo '</fontconfig>' >> /etc/fonts/fonts.conf && \
    fc-cache -fv && \
    echo "Verifying font listing:" && \
    fc-list | grep "Noto Sans JP" || echo "Font 'Noto Sans JP' not found by fc-list during build"

# Set environment variables for fontconfig (can potentially be moved after npm install)
ENV FONTCONFIG_PATH=/etc/fonts

# Copy package files (This should stay early)
COPY package.json package-lock.json ./

# Install dependencies (This should stay relatively early)
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