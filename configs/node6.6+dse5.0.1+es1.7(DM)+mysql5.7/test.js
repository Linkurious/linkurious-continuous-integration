module.exports = {
  dataSources: [
    {
      graphdb: {
        vendor: 'dse',
        url: 'ws://dse:8182',
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
  ],
  db: {
    name: 'linkurious',
    username: 'linkurious',
    password: 'pass',
    options: {
      dialect: 'mysql',
      host: 'mysql',
      port: 3306,
      storage: null
    }
  }
};
