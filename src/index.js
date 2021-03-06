// http://stackoverflow.com/questions/14934452/how-to-get-all-registered-routes-in-express/31501504#31501504

import Table from 'cli-table'

const METHODS = ['get', 'post', 'put', 'delete']

const beginRegisteringRoutes = app => {
  const routes = []

  const hasRouteFunction = typeof app.route === 'function'
  const isExpress5 = !app.del

  // monkey patch the `use` function to collect the Routers

  const oldUse = app.use
  app.use = function () {
    const urlBase = arguments[0]

    for (let i = 1; i < arguments.length; i++) {
      if (arguments[i] && arguments[i].name === 'router') {
        const router = arguments[i]
        const results = collectRoutesFromRouter(urlBase, router)
        routes.push(...results)
      }
    }

    return oldUse.apply(this, arguments)
  }

  // find routes given app.get, app.post, etc.

  // it seems that in express 5, "app.get" uses the same functionality as Router
  // I guess "app = express()" is an instance of Router
  // so, do not patch these in Express 5. Otherwise, each route would get collected twice
  if (!isExpress5) {
    for (const method of [...METHODS, 'all']) {
      const oldFn = app[method]

      app[method] = function () {
        if (arguments.length >= 2) {
          const path = arguments[0]
          collect(routes, method, path)
        }

        return oldFn.apply(this, arguments)
      }
    }
  }

  if (hasRouteFunction) {
    const oldRoute = app.route
    app.route = function (path) {
      const result = oldRoute.apply(this, arguments)

      for (const method of METHODS) {
        const oldFn = result[method]
        result[method] = function () {
          routes.push({
            path: removeTrailingSlash(path),
            method: method.toUpperCase()
          })

          return oldFn.apply(this, arguments)
        }
      }

      return result
    }
  }

  return {
    print: () => print(routes),
    getRoutes: () => routes
  }
}

const collectRoutesFromRouter = (pathBase, router) => {
  const routes = []

  for (const stackElement of router.stack.filter(stackElement => stackElement.route)) {
    const path = pathBase + stackElement.route.path
    const methodsOnStackElement = Object.keys(stackElement.route.methods)

    for (const method of methodsOnStackElement) {
      collect(routes, method, path)
    }
  }

  return routes
}

const collect = (routes, method, path) => {
  const upperMethod = method.toUpperCase()

  if (upperMethod === 'ALL' || upperMethod === '_ALL') {
    routes.push(...METHODS.map(m => ({
      method: m.toUpperCase(),
      path: removeTrailingSlash(path)
    })))
  } else {
    routes.push({
      method: upperMethod,
      path: removeTrailingSlash(path)
    })
  }
}

const format = routes => {
  const table = new Table({ head: ['Method', 'Path'] })

  for (const route of routes) {
    table.push({
      [route.method.toUpperCase()]: [route.path]
    })
  }

  return '(╯°□°）╯︵ ┻━┻\n' + table.toString()
}

// '/some/route/' -> '/some/route'
const removeTrailingSlash = path => {
  if (path !== '/' && path.endsWith('/')) {
    return path.substring(0, path.length - 1)
  } else {
    return path
  }
}

const print = routes => {
  console.log(format(routes))
}

module.exports = { begin: beginRegisteringRoutes }
