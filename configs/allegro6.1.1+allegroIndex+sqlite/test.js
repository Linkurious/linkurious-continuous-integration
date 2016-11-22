'use strict';

module.exports = {
  dataSources: [
    {
      graphdb: {
        vendor: 'allegroGraph',
        url: 'http://allegro:10035',
        repository: 'test',
        create: true,
        user: 'test',
        password: 'xyzzy',
        alternativeNodeId: null,
        alternativeEdgeId: null
      },
      index: {
        vendor: 'allegroIndex',
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
