#
# 5gmedia-vcompression-res Dockerfile
#
# Author: Igor Fritzsch
# Updated 11.12.2019
# See https://docs.docker.com/get-started/part2/#dockerfile

# docker rmi 5gmedia-vcompression-res
# docker build -t 5gmedia-vcompression-res .
# docker run --name 5gmedia-vcompression-res -p 3000:3000 --rm 5gmedia-vcompression-res
# docker run --name 5gmedia-vcompression-res -e FFMPEG_INPUT=tcp://[1050:2::2]:11000 -e FFMPEG_OUTPUT=[1050:3::4]:5004 -p 3000:3000 --rm 5gmedia-vcompression-res
# docker run --name 5gmedia-vcompression-res -p 3000:3000 --rm -it 5gmedia-vcompression-res /bin/bash
# docker run --name 5gmedia-vcompression-res -e FFMPEG_INPUT=tcp://[1050:2::2]:11000 -e FFMPEG_OUTPUT=[1050:3::4]:5004 -p 3000:3000 --rm -it 5gmedia-vcompression-res /bin/bash

FROM ubuntu:18.04 AS build

WORKDIR     /opt

COPY        . .

RUN \
            apt-get update -y && \
            apt-get install -y --no-install-recommends ca-certificates curl python build-essential wget && \
            curl -sL https://deb.nodesource.com/setup_10.x | bash - && \
            apt-get install -y --no-install-recommends nodejs && \
            wget -c https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
            tar xvf ffmpeg-release-amd64-static.tar.xz && \
            rm ffmpeg-release-amd64-static.tar.xz && \
            npm install --production && \
            apt-get autoremove -y && \
            apt-get clean -y

FROM ubuntu:18.04 AS release

ENV         FFMPEG_VERSION=4.2.2

WORKDIR     /opt

#CMD         []
CMD         nodejs index.js
#ENTRYPOINT  ["nodejs", "index.js"]

COPY        --from=build /opt/ .

EXPOSE      8885

RUN \
            apt-get update -y && \
            apt-get install -y --no-install-recommends ca-certificates curl fonts-dejavu-core && \
            cp ffmpeg-${FFMPEG_VERSION}-amd64-static/ff* /usr/local/bin/ && \
            cp ffmpeg-${FFMPEG_VERSION}-amd64-static/qt-faststart /usr/local/bin/ && \
            rm -R ffmpeg-${FFMPEG_VERSION}-amd64-static && \
            curl -sL https://deb.nodesource.com/setup_10.x | bash - && \
            apt-get install -y --no-install-recommends nodejs && \
            apt-get autoremove -y && \
            apt-get clean -y && \
            rm -rf /var/lib/apt/lists/*