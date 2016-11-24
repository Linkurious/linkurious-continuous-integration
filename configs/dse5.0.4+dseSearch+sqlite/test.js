'use strict';

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
        vendor: 'dseIndex',
        disableIndexExistCheck: true,
        host: null,
        port: null,
        forceReindex: null,
        dynamicMapping: null,
        user: null,
        password: null,
        https: null,
        analyzer: null
      }
    }
  ]
};
