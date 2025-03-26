@app
tb-website-remix

@aws
prune true
runtime nodejs20.x
memory 4096
region us-west-2
timeout 30
architecture x86_64
layers true
environment production

@http
/*
  method any
  src server

@static
fingerprint false