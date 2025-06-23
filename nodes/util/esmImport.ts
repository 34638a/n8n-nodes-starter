/**
 * This function dynamically imports a module using the ESM import syntax.
 * It is designed to be used in environments that support dynamic imports.
 *
 * @param {string} modulePath - The path to the module to be imported.
 * @returns {Promise<any>} A promise that resolves to the imported module.
 */
export const esmImport = new Function('modulePath', 'return import(modulePath)');
