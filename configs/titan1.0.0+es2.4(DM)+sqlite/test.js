module.exports = {
  dataSources: [
    {
      graphdb: {
        vendor: 'titan',
        url: 'ws://titan:8182'
      },
      index: {
        vendor: 'elasticSearch2',
        host: 'elasticsearch',
        port: 9200,
        dynamicMapping: true
      }
    }
  ]
};
