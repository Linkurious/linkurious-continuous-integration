module.exports = {
  dataSources: [
    {
      graphdb: {
        vendor: 'dse',
        url: 'ws://172.20.0.3:8182',
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
