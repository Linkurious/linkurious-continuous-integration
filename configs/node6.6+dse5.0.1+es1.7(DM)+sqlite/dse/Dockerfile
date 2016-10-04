FROM luketillman/datastax-enterprise:5.0.1

CMD sed -i 's/Production/Development/g' /opt/dse/resources/dse/conf/dse.yaml; dse cassandra -gf
