const co = require('co')
const _ = require('lodash')
const { Project } = require('./base-project')
const xraySrc = require('../src/xray-src')
const { ProxyTarget, ProxyData } = require('../db/models/index')


const spec1 = {
  name: 'Proxy',
  instances: 3,
  maxTrials: 10,
  useProxy: false,
  driver: null,
  url: 'https://incloak.com/proxy-list/',
  scope: '.proxy__t tr',
  selector: [{
    ip: 'td:nth-child(1)',
    port: 'td:nth-child(2)',
    country: 'td:nth-child(3)',
    speed: 'td:nth-child(4)',
    type: 'td:nth-child(5)',
    anonimity: 'td:nth-child(6)',
  }],
}

// extract data for db from xray result
function extractData(res) {
  const usable = _.filter(res, (obj) => {
    const accept = (parseInt(obj.speed, 10) < 2500 && obj.anonimity !== 'No')
    return accept
  })

  const extracted = _.map(usable, (obj) => {
    const type = _.toLower(_.trim(_.last(_.split(obj.type, ','))))
    const ip = `${type}://${obj.ip}:${obj.port}`
    return {
      url: spec1.url,
      ip,
      country: _.trim(obj.country),
      speed: parseInt(obj.speed, 10),
      anonimity: obj.anonimity,
      usable: true,
    }
  })
  return extracted
}

// create and run an instance of xray
const scrape = co.wrap(function* fn(target) {
  const xray = xraySrc.get(spec1.driver)
  const res = yield xray(target.url, spec1.scope, spec1.selector)
    .paginate('.proxy__pagination a@href')
    .limit(3)
    .promisify()

  // update the db
  const data = extractData(res)
  yield _.map(data, (proxy) => {
    return ProxyData.findOrCreate({ where: proxy })
  })
  return data
})

const project = new Project(spec1, ProxyTarget, ProxyData, scrape)

project.run()
// project.resetAndClear(true)
