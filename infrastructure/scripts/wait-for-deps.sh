#!/bin/sh
set -eu

host="$1"
port="$2"

until node -e "const net=require('node:net'); const socket=net.createConnection({host: process.argv[1], port: Number(process.argv[2])}); socket.on('connect', ()=>{socket.end(); process.exit(0);}); socket.on('error', ()=>process.exit(1));" "$host" "$port"; do
  echo "Waiting for $host:$port"
  sleep 1
done
