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
        vendor: 'dseIndex'
      }
    }
  ]
};
