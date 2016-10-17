module.exports = {
  dataSources: [
    {
      graphdb: {
        vendor: 'neo4j',
        url: 'http://neo4j:7474'
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
