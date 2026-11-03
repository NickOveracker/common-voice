# The app for a private instance (see README.md). Based on upstream's
# docker/Dockerfile, built with the private-instance settings the web build
# needs, and run without the development watchers.
FROM node:18-bookworm

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

# Read by webpack at build time
ARG CV_PRIVATE_INSTANCE=true
ARG CV_CONTACT_EMAIL=""
ENV CV_PRIVATE_INSTANCE=$CV_PRIVATE_INSTANCE \
    CV_CONTACT_EMAIL=$CV_CONTACT_EMAIL

# The build runs as the unprivileged node user, which must own /code
RUN mkdir /code && chown node:node /code
WORKDIR /code
COPY --chown=node:node . /code
USER node

RUN yarn --frozen-lockfile --ignore-scripts && yarn build

EXPOSE 9000
CMD ["node", "--trace-warnings", "server/js/main.js"]
