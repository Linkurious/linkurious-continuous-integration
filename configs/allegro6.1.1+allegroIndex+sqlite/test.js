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
        vendor: 'allegroIndex'
      }
    }
  ]
};
