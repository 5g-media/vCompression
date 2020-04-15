## 5gmedia-vcompression-res
vCompression Engine that can change the resolution on-the-fly.

## Requirements
- node.js 8.x and higher
- ffmpeg

## Installation
```
npm install
```

## Usage
```
node index.js
```

## API
The following api endpoints are available:
```
GET /                      Gets status
```
```
POST /resolution/low       Sets low resolution
```
```
POST /resolution/high      Sets high resolution
```
