@app
tb-website-remix

@aws
profile arc_deployer
runtime nodejs20.x
memory 1152
region us-west-2
timeout 30
architecture x86_64

@http
/*
  method any
  src server

@static
fingerprint false