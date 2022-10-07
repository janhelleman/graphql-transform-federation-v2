import { ServerInfo } from 'apollo-server';

const { ApolloServer, gql } = require('apollo-server');
const { buildSubgraphSchema } = require('@apollo/federation');

const typeDefs = gql`
  type Product @key(fields: "id") {
    id: String!
    price: Int
    weight: Int
  }

  type Category @key(fields: "id") {
    id: ID!
    name: String
  }

  type Query {
    findProduct: Product!
  }
`;

interface CategoryKey {
  id: String;
}

const product = {
  id: '123',
  price: 899,
  weight: 100,
};

const categories = [
  {
    id: '456',
    name: 'mand',
  },
];

const resolvers = {
  Category: {
    __resolveReference: ({ id }: CategoryKey) => {
      return categories.find((item) => item.id == id);
    },
  },
  Query: {
    findProduct() {
      return product;
    },
  },
};

const server = new ApolloServer({
  schema: buildSubgraphSchema([
    {
      typeDefs,
      resolvers,
    },
  ]),
});

server.listen({ port: 4002 }).then(({ url }: ServerInfo) => {
  console.log(`🚀 Federation server ready at ${url}`);
});
