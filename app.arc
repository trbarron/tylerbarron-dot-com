@app
tb-website-remix

@aws
runtime nodejs20.x
memory 1152
region us-west-1
timeout 30
profile default

@http
/*
  method any
  src server

@plugins
remix-vite
  src plugin-vite.js

@static
fingerprint true