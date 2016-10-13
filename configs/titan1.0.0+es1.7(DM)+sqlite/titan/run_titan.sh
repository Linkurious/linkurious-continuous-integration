#!/bin/bash

sed -i "s/host: localhost/host: 0.0.0.0/g" conf/gremlin-server/gremlin-server.yaml

./bin/titan.sh start; sleep 1000
