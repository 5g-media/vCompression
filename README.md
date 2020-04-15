## 5gmedia-vcompression
vCompression Engine which allows the bitrate to be changed on the fly.

## Requirements
- node.js 8.x and higher
- ffmpeg (special edition)

## Installation
```
npm install
```
#### Note
If using *UUID* as `KAFKA_IDENTIFIER` you must change the sudoers file since dmidecode has to be run as root.  Edit sudoers file using visudo:
```
<USER> ALL=NOPASSWD:/usr/sbin/dmidecode
```
Change `<USER>` respectively.
## Usage
```
node index.js
```

## API
The following api endpoints are available:
```
GET /                   Finds vcompression's status
```
```
POST /bitrate/{value}   Set vcompression's bitrate [kbps]
```

### Example usage
```
curl -X POST http://localhost:3000/bitrate/3000
```

## Install as systemd service
Create a file with name vcompression.service and copy it to either /lib/systemd/system or /etc/systemd/system.
```
nano /etc/systemd/system/vcompression.service
```
File vcompression.service:
```
[Unit]
Description=vCompression - a compression service
After=network.target

[Service]
Type=simple
User=irt
WorkingDirectory=/home/irt/vcompression
ExecStart=/usr/bin/node index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
Reload systemd manager configuration:
```
systemctl daemon-reload
```
Enable service:
```
systemctl enable vcompression.service
```
Start service:
```
systemctl start vcompression.service
```
Check status of service:
```
systemctl status vcompression.service
```