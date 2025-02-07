@app
tb-website-remix

@aws
prune true
runtime nodejs20.x
memory 1152
region us-west-2
timeout 30
architecture x86_64
layer-name production-dependencies

@http
/*
  method any
  src server

@static
fingerprint false