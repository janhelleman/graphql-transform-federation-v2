import { makeExecutableSchema } from '@graphql-tools/schema';
import { delegateToSchema } from '@graphql-tools/delegate';
import { ApolloServer } from 'apollo-server';
import { transformSchemaFederation } from '../src/transform-federation';
import {
  GraphQLNamedType,
  GraphQLOutputType,
  OperationTypeNode,
} from 'graphql';

const products = [
  {
    id: '123',
    name: 'name from transformed service',
  },
];

const categories = [
  {
    id: '456',
  },
];

interface ProductKey {
  id: string;
}
interface CategoryKey {
  id: string;
}

const schemaWithoutFederation = makeExecutableSchema({
  typeDefs: `
    type Product {
      id: String!
      name: String!
    }

    type Category {
      id: ID!
    }
    
    type Query {
      categoryById(id: ID!): Category
      productById(id: String!): Product!
    }
  `,
  resolvers: {
    Query: {
      productById(source, { id }: ProductKey) {
        return products.find((product) => product.id === id);
      },
      categoryById(source, { id }: CategoryKey) {
        return categories.find((category) => category.id === id);
      },
    },
  },
});

const federationSchema = transformSchemaFederation(schemaWithoutFederation, {
  Query: {
    extend: true,
  },
  Category: {
    extend: false,
    resolvable: false,
    keyFields: ['id'],
  },
  Product: {
    extend: true,
    keyFields: ['id'],
    fields: {
      id: {
        external: true,
      },
    },
    resolveReference(reference, context: { [key: string]: any }, info) {
      return delegateToSchema({
        schema: info.schema,
        operation: OperationTypeNode.QUERY,
        fieldName: 'productById',
        args: {
          id: (reference as ProductKey).id,
        },
        context,
        info,
        returnType: info.schema.getType('Product') as GraphQLOutputType,
      });
    },
  },
});

new ApolloServer({
  schema: federationSchema,
})
  .listen({
    port: 4001,
  })
  .then(({ url }) => {
    console.log(`🚀 Transformed server ready at ${url}`);
  });
