#
# 5gmedia-vcompression-lb Dockerfile
#
# Author: Igor Fritzsch
# Created 08.02.2019
# See https://docs.docker.com/get-started/part2/#dockerfile

# docker rmi 5gmedia-vcompression-lb
# docker build -t 5gmedia-vcompression-lb .
# docker run --name 5gmedia-vcompression-lb -p 1935:1935 -p 3000:3000 -d 5gmedia-vcompression-lb
# docker run --name 5gmedia-vcompression-lb -p 1935:1935 -p 3000:3000 -it 5gmedia-vcompression-lb /bin/bash

# Use the official debian runtime as a parent image
FROM ubuntu:16.04

# Install the basic things
RUN apt-get update \
   && apt-get install -y \
      sudo \
      curl \
	  gnupg \
	  nano \
   && apt-get install -y \
      autoconf \
      automake \
      build-essential \
      cmake \
      git-core \
      libass-dev \
      libfreetype6-dev \
      libsdl2-dev \
      libtool \
      libva-dev \
      libvdpau-dev \
      libvorbis-dev \
      libxcb1-dev \
      libxcb-shm0-dev \
      libxcb-xfixes0-dev \
      pkg-config \
      texinfo \
      wget \
      zlib1g-dev \
   && apt-get install -y \
      nasm \
      yasm \
      libx264-dev \
      libx265-dev \
      libnuma-dev \
      libvpx-dev \
      libfdk-aac-dev \
      libmp3lame-dev \
      libopus-dev \
   && apt-get clean \
   && rm -rf /var/lib/apt/lists/*

# Copy related files
COPY . /opt/

# Install ffmpeg
RUN mkdir -p ~/ffmpeg_sources ~/bin && \
    cd ~/ffmpeg_sources && \
    wget -O ffmpeg-snapshot.tar.bz2 https://ffmpeg.org/releases/ffmpeg-snapshot.tar.bz2 && \
    tar xjvf ffmpeg-snapshot.tar.bz2 && \
    cd ffmpeg && \
    patch -p1 ~/ffmpeg_sources/ffmpeg/fftools/ffmpeg.c < /opt/ffmpeg.diff && \
    PATH="$HOME/bin:$PATH" PKG_CONFIG_PATH="$HOME/ffmpeg_build/lib/pkgconfig" ./configure \
          --prefix="$HOME/ffmpeg_build" \
          --pkg-config-flags="--static" \
          --extra-cflags="-I$HOME/ffmpeg_build/include" \
          --extra-ldflags="-L$HOME/ffmpeg_build/lib" \
          --extra-libs="-lpthread -lm" \
          --bindir="$HOME/bin" \
          --enable-gpl \
          --enable-libass \
          --enable-libfdk-aac \
          --enable-libfreetype \
          --enable-libmp3lame \
          --enable-libopus \
          --enable-libvorbis \
          --enable-libvpx \
          --enable-libx264 \
          --enable-libx265 \
          --enable-nonfree && \
        PATH="$HOME/bin:$PATH" make && \
        make install && \
        hash -r && \
        cp ~/bin/ff* /usr/local/bin/

# Install nodejs
RUN curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
RUN apt-get install -y nodejs

# Set the working directory
WORKDIR /opt/

# Install service
RUN npm install

# Run service forever
CMD node index.js

# Expose port 1935 3000
EXPOSE 1935 3000
