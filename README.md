# AST Complexity Analyzer

This project is a static analysis tool designed to evaluate the time and space complexity of C++ code snippets automatically.

## How It Works: Tree-sitter AST Parsing

The Node.js backend leverages **Tree-sitter**, a highly optimized and robust parser generator framework, to parse C++ code into a structured Abstract Syntax Tree (AST). 

Unlike standard regex-based analysis which is fragile against code formatting, Tree-sitter parses the actual grammatical structure of the codebase. Our backend service (`src/services/astParser.js`) traverses this structure:

1. **AST Generation**: The C++ code is parsed via the `tree-sitter-cpp` grammar, generating a syntax tree where every expression and statement is a distinct node.
2. **TreeCursor Traversal**: We use Tree-sitter's `TreeCursor` to efficiently walk through the hierarchy of the syntax tree.
3. **Time Complexity Tracking**: As the cursor walks down, it detects `for_statement`, `while_statement`, and `do_statement` nodes. By tracking the nesting depth of these loops, the analyzer mathematically deduces the Big O notation (e.g., `O(N)`, `O(N^2)`).
4. **Space Complexity Detection**: The cursor identifies `new_expression` nodes (dynamically allocated arrays) and `declaration` nodes containing `std::vector` to confidently flag `O(N)` space complexity.
5. **Recursion Validation**: The analyzer extracts names from `function_definition` nodes and cross-references them against child `call_expression` identifiers to precisely catch direct recursion.

## Features
- **Monaco Editor Frontend**: Write and test code inside a fully-featured, syntax-highlighted browser IDE.
- **Dynamic Editor Decorators**: Code lines with detected loop patterns are automatically highlighted in the editor.
- **MongoDB History**: Every analysis is saved instantly, making it easy to review historical evaluations on the dashboard.