'use strict';

module.exports = {
  dataSources: [
    {
      graphdb: {
        vendor: 'titan',
        url: 'ws://titan:8182',
        configurationPath: '/opt/titan-1.0.0-hadoop1/conf/titan-cassandra-es.properties'
      },
      index: {
        vendor: 'elasticSearch',
        host: 'elasticsearch',
        port: 9200,
        dynamicMapping: true
      }
    }
  ]
};
