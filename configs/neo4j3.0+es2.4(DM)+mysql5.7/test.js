'use strict';

module.exports = {
  dataSources: [
    {
      graphdb: {
        vendor: 'neo4j',
        url: 'http://neo4j:7474'
      },
      index: {
        vendor: 'elasticSearch2',
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
