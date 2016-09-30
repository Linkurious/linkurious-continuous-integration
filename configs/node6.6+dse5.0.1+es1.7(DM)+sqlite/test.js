module.exports = {
  dataSources: [
    {
      graphdb: {
        vendor: 'dse',
        url: 'ws://datastax:9042',
        graphName: 'test',
        create: true
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
