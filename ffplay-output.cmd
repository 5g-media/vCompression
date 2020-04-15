@echo off
set /p SYNC="Use sync option? [Y/n]"

IF /I "%SYNC%"=="n" GOTO NOSYNC
GOTO SYNC

:SYNC
echo "Start ffplay with sync option"
ffplay -probesize 32 -sync ext rtmp://localhost/live/stream
GOTO EXIT

:NOSYNC
echo "Start ffplay without sync option"
ffplay -probesize 32 rtmp://localhost/live/stream
GOTO EXIT

:EXIT
echo "Close ffplay"