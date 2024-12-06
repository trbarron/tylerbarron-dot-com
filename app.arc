@app
tb-website-remix

@aws
profile arc_deployer
runtime nodejs20.x
memory 1152
region us-west-2
timeout 30

@http
/*
  method any
  src server

@plugins
remix-vite
  src plugin-vite.mjs

@static
fingerprint true
prefs
  types
    application/javascript js mjs
    text/css css
    image/svg+xml svg
    application/json json