@echo off
E:
cd "Startup Business in Canada\10th idea - Home buying April 2026\Website\homecashbacks-website"
echo Building site...
node build.js
echo.
echo Starting preview server...
start http://localhost:3000
serve dist --listen 3000
