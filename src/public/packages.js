import _ from 'lodash';

import {listAllPackages, listChangedPackages, listTestablePackages} from '../lib/packages';
import {colorizeNumber, colorizePackageName, makeDebug} from '../lib/debug';

import {listDirectDependencies, listTransitiveDependencies, listDirectDependents, listTransitiveDependents} from './dependencies';

const debug = makeDebug(`${__filename}`);

/**
 * Lists the dependencies of a given package
 * @param {string} packageName
 * @param {Object} options
 * @param {boolean} [options.dependents=false}]
 * @param {boolean} [options.localOnly=false}]
 * @param {boolean} [options.includeTransitive=true}]
 * @returns {Promise<Array<string>>}
 */
export async function listDependencies(packageName, {includeTransitive = true, localOnly = false}) {
  debug(`Finding dependencies for ${colorizePackageName(packageName)}`);

  const packages = await listAllPackages();

  const deps = includeTransitive ? await listTransitiveDependencies(packageName) : await listDirectDependencies(packageName);

  if (localOnly) {
    debug(`Returning local dependencies for ${colorizePackageName(packageName)}`);
    return deps
      .filter((d) => packages.includes(d))
      .sort();
  }

  debug(`Returning all dependencies for ${colorizePackageName(packageName)}`);
  return deps;
}

/**
 * Returns all the packages that depend on packageName and (optionall), the
 * packages that depend on them
 * @param {string} packageName
 * @param {Object} [options]
 * @param {boolean} [options.includeTransitive=false]
 * @returns {Promise<Array<string>>}
 */
export function listDependents(packageName, {includeTransitive = false} = {}) {
  return includeTransitive ? listTransitiveDependents(packageName) : listDirectDependents(packageName);
}

/**
 * Lists all packages
 * @param {Object} options
 * @param {boolean} options.testable when true, only packages with tests will be
 * included in the result
 * @returns {Promise<string>}
 */
export async function listPackages({
  changed = false, includeTransitive = true, ignoreTooling = false, testable = false
} = {}) {
  let packages;

  if (changed) {
    debug('Starting from all packages');
    packages = await listChangedPackages();
  }
  else {
    debug('Starting from changed packages');
    packages = await listAllPackages();
  }

  if (ignoreTooling) {
    debug('Removing "tooling" from package list');
    packages = packages.filter((p) => p !== 'tooling');
  }

  if (testable) {
    if (packages.includes('tooling')) {
      debug('Found tooling to have changed, resetting to all packages');
      packages = await listAllPackages();
    }

    debug('Removing packages that do not have tests');
    packages = await removeUntestablePackages(packages);
  }

  if (changed && includeTransitive && !packages.includes('tooling')) {
    debug('Expanding changed packages to include dependents');
    packages = await expandToDependents(packages);
  }

  debug(`Returning ${colorizeNumber(packages.length)} packages`);
  return packages;
}

/**
 * Expands a set of packages to include all of their collective dependent
 * packages
 * @param {Array<string>} packages
 * @returns {Promise<Array<string>>}
 */
async function expandToDependents(packages) {
  let allPackages = [];
  for (const packageName of packages) {
    allPackages = allPackages.concat(await listDependents(packageName, {includeTransitive: true}));
  }
  return allPackages;

}

/**
 * Filters out packages that don't have tests
 * @param {Array<string>} packages
 * @returns {Promise<Array<string>>}
 */
async function removeUntestablePackages(packages) {
  const testable = await listTestablePackages();
  return _.intersection(testable, packages);
}
