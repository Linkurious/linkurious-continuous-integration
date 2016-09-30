module.exports = {
  dataSources: [
    {
      graphdb: {
        vendor: 'allegroGraph',
        url: 'http://allegro:10035',
        repository: 'test',
        create: true,
        alternativeNodeId: null,
        alternativeEdgeId: null
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
