# Use the official Puppeteer image
FROM ghcr.io/puppeteer/puppeteer:latest

# --- THE FIX: Switch to Administrator (Root) ---
# This fixes the "Permission Denied" / Exit Code 243 error
USER root

# Set the folder
WORKDIR /usr/src/app

# Copy the file that lists your requirements
COPY package.json ./

# Tell the system we already have Chrome (don't download it again)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install the requirements (Now running as Root, so it won't fail!)
RUN npm install

# Copy the rest of your bot code
COPY bot.mjs ./

# Start the bot
CMD [ "node", "bot.mjs" ]
