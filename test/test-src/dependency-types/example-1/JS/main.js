import { helperFunc } from './helper.js'
import { Base } from './base.js'
const helper = require('./helper.js')

class Derived extends Base {
  method () {
    const b = new Base()
    return b
  }
}

function topFunc () {
  helperFunc()
}

function anotherFunc () {
  helperFunc()
}
