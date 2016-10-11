module.exports = {
  dataSources: [
    {
      graphdb: {
        vendor: 'titan',
        url: 'ws://titan:8182',
        configurationPath: '/conf/titan-cassandra-es.properties'
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