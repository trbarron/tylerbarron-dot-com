@app
tb-website-remix

@aws
runtime nodejs18.x
memory 1152
region us-west-1
timeout 30
profile default

@http
/*
  method any
  src server

@plugins
plugin-remix
  src plugin-remix.js

@static
fingerprint true