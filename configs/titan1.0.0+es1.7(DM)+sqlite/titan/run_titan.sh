#!/bin/bash

BIN=./bin

#############################################################################
# based on https://github.com/davebshow/titan-gremlin/blob/master/run.sh    #
# we use dockerize to wait on es and cassandra                              #
#############################################################################

dockerize -wait tcp://elasticsearch:9200 -wait tcp://cassandra:9160 -timeout 60s;

# use cassandra backed db instead of berkeleyje
sed -i "s/host: localhost/host: 0.0.0.0/g" conf/gremlin-server/gremlin-server.yaml
sed -i "s/titan-berkeleyje-server.properties/titan-cassandra-server.properties/g" conf/gremlin-server/gremlin-server.yaml

# create the backing file
echo "gremlin.graph=com.thinkaurelius.titan.core.TitanFactory
storage.backend=cassandra
storage.hostname=cassandra" > conf/gremlin-server/titan-cassandra-server.properties

$BIN/gremlin-server.sh conf/gremlin-server/gremlin-server.yaml
