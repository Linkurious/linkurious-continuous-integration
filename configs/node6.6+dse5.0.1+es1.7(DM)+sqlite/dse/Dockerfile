FROM luketillman/datastax-enterprise:5.0.1

RUN sed -i '64ised -i "s/Production/Development/g" /opt/dse/resources/dse/conf/dse.yaml' entrypoint.sh

CMD dse cassandra -gf
