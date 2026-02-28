/**
 * Babel plugin to strip debug logger calls in production builds
 * 
 * This plugin safely removes:
 * - Imports from '@/utils/debug'
 * - Variables initialized with useDebugLogger() or createDebugLogger()
 * - All calls to those debug logger variables (regardless of variable name)
 * 
 * Uses proper scope tracking and binding management to avoid removing unrelated code.
 */
module.exports = function ({ types: t }) {
    return {
        name: 'strip-debug-calls',
        visitor: {
            Program: {
                exit(path, state) {
                    // Collect debug logger bindings
                    const debugLoggerBindings = new Set();
                    const debugImportNames = new Set();

                    // Find all imports from @/utils/debug
                    path.traverse({
                        ImportDeclaration(importPath) {
                            const source = importPath.node.source.value;
                            if (source !== '@/utils/debug') return;

                            // Track imported function names
                            importPath.node.specifiers.forEach(specifier => {
                                if (t.isImportSpecifier(specifier) || t.isImportDefaultSpecifier(specifier)) {
                                    debugImportNames.add(specifier.local.name);
                                }
                            });
                        }
                    });

                    // Find all variable declarations that use the imported debug functions
                    path.traverse({
                        VariableDeclarator(declaratorPath) {
                            const init = declaratorPath.node.init;
                            const id = declaratorPath.node.id;

                            if (!init || !t.isIdentifier(id)) return;

                            // Check if it's a call to useDebugLogger or createDebugLogger
                            if (
                                t.isCallExpression(init) &&
                                t.isIdentifier(init.callee) &&
                                debugImportNames.has(init.callee.name)
                            ) {
                                // Get the binding for this debug logger variable
                                const binding = declaratorPath.scope.getBinding(id.name);
                                if (binding) {
                                    debugLoggerBindings.add(binding);
                                }
                            }
                        }
                    });

                    // Remove all references to debug loggers (calls to them)
                    debugLoggerBindings.forEach(binding => {
                        binding.referencePaths.forEach(refPath => {
                            // Only remove if it's being called
                            const parent = refPath.parent;
                            if (t.isCallExpression(parent) && parent.callee === refPath.node) {
                                const statement = refPath.getStatementParent();
                                if (statement) {
                                    statement.remove();
                                }
                            }
                        });
                    });

                    // Remove the variable declarations for debug loggers
                    debugLoggerBindings.forEach(binding => {
                        const declarator = binding.path;
                        if (declarator && t.isVariableDeclarator(declarator.node)) {
                            const declaration = declarator.parentPath;
                            if (
                                declaration &&
                                t.isVariableDeclaration(declaration.node) &&
                                declaration.node.declarations.length === 1
                            ) {
                                declaration.remove();
                            } else {
                                declarator.remove();
                            }
                        }
                    });

                    // Remove imports from @/utils/debug
                    path.traverse({
                        ImportDeclaration(importPath) {
                            const source = importPath.node.source.value;
                            if (source === '@/utils/debug') {
                                importPath.remove();
                            }
                        }
                    });
                },
            },
        },
    };
};
