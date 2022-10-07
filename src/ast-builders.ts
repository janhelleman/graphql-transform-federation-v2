import {
  NameNode,
  StringValueNode,
  BooleanValueNode,
  Kind,
  ConstDirectiveNode,
  ConstArgumentNode,
  ConstValueNode,
} from 'graphql/language';

export function createNameNode(value: string): NameNode {
  return {
    kind: Kind.NAME,
    value,
  };
}

export function createStringValueNode(
  value: string,
  block = false,
): StringValueNode {
  return {
    kind: Kind.STRING,
    value,
    block,
  };
}

export function createBooleanValueNode(value: boolean): BooleanValueNode {
  return {
    kind: Kind.BOOLEAN,
    value,
  };
}

export function createDirectiveNode(
  name: string,
  directiveArguments: { [argumentName: string]: ConstValueNode } = {},
): ConstDirectiveNode {
  return {
    kind: Kind.DIRECTIVE,
    name: createNameNode(name),
    arguments: Object.entries(directiveArguments).map(
      ([argumentName, value]): ConstArgumentNode => ({
        kind: Kind.ARGUMENT,
        name: createNameNode(argumentName),
        value,
      }),
    ),
  };
}
