import Parser from "tree-sitter";
import TreeSitterC from "tree-sitter-c";
import TreeSitterCpp from "tree-sitter-cpp";
import TreeSitterGo from "tree-sitter-go";
import TreeSitterJava from "tree-sitter-java";
import TreeSitterPython from "tree-sitter-python";
import TreeSitterRust from "tree-sitter-rust";
import TreeSitterTypeScript from "tree-sitter-typescript";
import type { Language } from "../types/scan.js";

export interface ParsedFunction {
  name: string;
  startLine: number;
  endLine: number;
  source: string;
}

type ParserLanguage = Parameters<Parser["setLanguage"]>[0];
type SyntaxNode = Parser.SyntaxNode;

interface ParserDefinition {
  grammar: ParserLanguage;
  functionNodeTypes: Set<string>;
}

const TYPESCRIPT_GRAMMAR = (TreeSitterTypeScript as unknown as { typescript: ParserLanguage }).typescript;

const PARSER_DEFINITIONS: Record<Language, ParserDefinition> = {
  go: {
    grammar: TreeSitterGo as ParserLanguage,
    functionNodeTypes: new Set(["function_declaration", "method_declaration"])
  },
  python: {
    grammar: TreeSitterPython as ParserLanguage,
    functionNodeTypes: new Set(["function_definition"])
  },
  typescript: {
    grammar: TYPESCRIPT_GRAMMAR,
    functionNodeTypes: new Set(["function_declaration", "method_definition"])
  },
  java: {
    grammar: TreeSitterJava as ParserLanguage,
    functionNodeTypes: new Set(["method_declaration", "constructor_declaration"])
  },
  rust: {
    grammar: TreeSitterRust as ParserLanguage,
    functionNodeTypes: new Set(["function_item"])
  },
  c: {
    grammar: TreeSitterC as ParserLanguage,
    functionNodeTypes: new Set(["function_definition"])
  },
  cpp: {
    grammar: TreeSitterCpp as ParserLanguage,
    functionNodeTypes: new Set(["function_definition"])
  }
};

function extractNodeText(source: string, node: SyntaxNode): string {
  return source.slice(node.startIndex, node.endIndex);
}

function visitNode(node: SyntaxNode, callback: (node: SyntaxNode) => void): void {
  callback(node);
  for (const child of node.namedChildren) {
    visitNode(child, callback);
  }
}

function findNamedIdentifier(node: SyntaxNode | null): SyntaxNode | null {
  if (!node) {
    return null;
  }

  if (
    node.type === "identifier" ||
    node.type === "field_identifier" ||
    node.type === "property_identifier" ||
    node.type === "type_identifier"
  ) {
    return node;
  }

  for (const child of node.namedChildren) {
    const match = findNamedIdentifier(child);
    if (match) {
      return match;
    }
  }

  return null;
}

function resolveFunctionName(node: SyntaxNode, source: string): string {
  const directName = node.childForFieldName("name");
  if (directName) {
    const name = extractNodeText(source, directName).trim();
    if (name) {
      return name;
    }
  }

  const declarator = node.childForFieldName("declarator");
  const declaratorName = findNamedIdentifier(declarator);
  if (declaratorName) {
    return extractNodeText(source, declaratorName).trim();
  }

  if (node.parent) {
    const parentName = node.parent.childForFieldName("name");
    if (parentName) {
      const text = extractNodeText(source, parentName).trim();
      if (text) {
        return text;
      }
    }
  }

  return `anonymous_${node.startPosition.row + 1}`;
}

function deduplicate(functions: ParsedFunction[]): ParsedFunction[] {
  const seen = new Set<string>();
  const result: ParsedFunction[] = [];

  for (const fn of functions) {
    const key = `${fn.name}:${fn.startLine}:${fn.endLine}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(fn);
  }

  return result;
}

export function extractFunctionsFromSource(
  language: Language,
  source: string,
  minFunctionLines: number
): ParsedFunction[] {
  const definition = PARSER_DEFINITIONS[language];
  const parser = new Parser();
  parser.setLanguage(definition.grammar);

  const tree = parser.parse(source);
  const functions: ParsedFunction[] = [];

  visitNode(tree.rootNode, (node) => {
    if (!definition.functionNodeTypes.has(node.type)) {
      return;
    }

    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    if (endLine - startLine + 1 < minFunctionLines) {
      return;
    }

    functions.push({
      name: resolveFunctionName(node, source),
      startLine,
      endLine,
      source: extractNodeText(source, node)
    });
  });

  return deduplicate(functions);
}
