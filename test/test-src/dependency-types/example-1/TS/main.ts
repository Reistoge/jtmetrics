import { helperFunc } from './helper'
import { Base, Renderable } from './base'
import helper = require('./helper')

class Derived extends Base implements Renderable {
  method () {
    const b = new Base()
    return b
  }
}

function topFunc (): number {
  return helperFunc()
}

function anotherFunc (): number {
  return helperFunc()
}
