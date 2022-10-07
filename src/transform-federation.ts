import { mapSchema, MapperKind } from '@graphql-tools/utils';
import {
  GraphQLResolveInfo,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLUnionType,
  isObjectType,
  isUnionType,
  printSchema,
} from 'graphql';
import { addFederationAnnotations } from './transform-sdl';
import {
  entitiesField,
  EntityType,
  // GraphQLReferenceResolver,
  serviceField,
} from '@apollo/subgraph/dist/types';

type GraphQLReferenceResolver<TContext> = (
  reference: object,
  context: TContext,
  info: GraphQLResolveInfo,
) => any;

export interface FederationFieldConfig {
  external?: boolean;
  provides?: string;
  requires?: string;
}

export interface FederationFieldsConfig {
  [fieldName: string]: FederationFieldConfig;
}

export interface FederationObjectConfig<TContext> {
  keyFields?: string[];
  extend?: boolean;
  resolvable?: boolean;
  resolveReference?: GraphQLReferenceResolver<TContext>;
  fields?: FederationFieldsConfig;
}

export interface FederationConfig<TContext> {
  [objectName: string]: FederationObjectConfig<TContext>;
}

export function transformSchemaFederation<TContext>(
  schema: GraphQLSchema,
  federationConfig: FederationConfig<TContext>,
): GraphQLSchema {
  const schemaWithFederationDirectives = addFederationAnnotations(
    printSchema(schema),
    federationConfig,
  );

  const schemaWithQueryType = !schema.getQueryType()
    ? new GraphQLSchema({
        ...schema.toConfig(),
        query: new GraphQLObjectType({
          name: 'Query',
          fields: {},
        }),
      })
    : schema;

  const entityTypes = Object.fromEntries(
    Object.entries(federationConfig)
      .filter(([, { keyFields }]) => keyFields && keyFields.length)
      .map(([objectName]) => {
        const type = schemaWithQueryType.getType(objectName);
        if (!isObjectType(type)) {
          throw new Error(
            `Type "${objectName}" is not an object type and can't have a key directive`,
          );
        }
        return [objectName, type];
      }),
  );

  const hasEntities = !!Object.keys(entityTypes).length;

  const schemaWithFederationQueryType = mapSchema(schemaWithQueryType, {
    [MapperKind.ROOT_OBJECT](type) {
      if (
        isObjectType(type) &&
        type.name === schemaWithQueryType.getQueryType()?.name
      ) {
        const config = type.toConfig();

        return new GraphQLObjectType({
          ...config,
          fields: {
            ...config.fields,
            ...(hasEntities && { _entities: entitiesField }),
            _service: {
              ...serviceField,
              resolve: () => ({ sdl: schemaWithFederationDirectives }),
            },
          },
        });
      }

      return undefined;
    },
  });

  const schemaWithUnionType = mapSchema(schemaWithFederationQueryType, {
    [MapperKind.UNION_TYPE](type) {
      if (isUnionType(type) && type.name === EntityType.name) {
        return new GraphQLUnionType({
          ...EntityType.toConfig(),
          types: Object.values(entityTypes),
        });
      }
      return undefined;
    },
  });

  type ReferenceResolverMap = {
    [key: string]: GraphQLReferenceResolver<TContext>;
  };

  const referenceResolvers: ReferenceResolverMap = Object.entries(
    federationConfig,
  )
    .filter(([, config]) => !!config.resolveReference)
    .reduce(
      (result: ReferenceResolverMap, [key, { resolveReference }]) => ({
        ...result,
        [key]: resolveReference!,
      }),
      {},
    );

  const schemaWithResolveReference = mapSchema(schemaWithUnionType, {
    [MapperKind.OBJECT_TYPE](type) {
      const typeName = type.name;

      if (referenceResolvers[typeName]) {
        return new GraphQLObjectType({
          ...type.toConfig(),
          extensions: {
            ...type.extensions,
            apollo: {
              ...(type.extensions?.apollo || {}),
              subgraph: {
                resolveReference: referenceResolvers[typeName],
              },
            },
          },
        });
      }
      return type;
    },
  });

  return schemaWithResolveReference;
}
